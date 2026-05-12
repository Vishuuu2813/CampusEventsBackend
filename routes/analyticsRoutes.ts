import express from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { College } from '../models/College';
import { User } from '../models/User';
import { Event } from '../models/Event';
import { Registration } from '../models/Registration';
import { Department } from '../models/Department';

import { AuditLog } from '../models/AuditLog';
import { SystemSettings } from '../models/SystemSettings';

import { Transaction } from '../models/Transaction';

const router = express.Router();


// Helper to log audit actions
const logAudit = async (userId: string, action: string, module: string, details: string) => {
  try {
    await AuditLog.create({ userId, action, module, details });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
};


// Super Admin Stats
router.get('/super-admin', authMiddleware, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const [totalColleges, totalStudents, totalEvents, totalRegistrations] = await Promise.all([
      College.countDocuments(),
      User.countDocuments({ role: 'student' }),
      Event.countDocuments(),
      Registration.countDocuments()
    ]);

    // Recent registrations for overview
    const recentRegistrations = await Registration.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('user', 'name email')
      .populate('event', 'title')
      .populate('college', 'name');

    // Growth Data (Last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const growthData = await Registration.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // College Distribution (Students per college)
    const collegeDistribution = await User.aggregate([
      { $match: { role: 'student' } },
      {
        $group: {
          _id: '$college',
          studentCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'colleges',
          localField: '_id',
          foreignField: '_id',
          as: 'collegeInfo'
        }
      },
      { $unwind: '$collegeInfo' },
      {
        $project: {
          name: '$collegeInfo.name',
          studentCount: 1
        }
      },
      { $sort: { studentCount: -1 } },
      { $limit: 5 }
    ]);

    // Category Distribution
    const categoryDistribution = await Event.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Daily Activity (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailyActivity = await Registration.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // System Settings
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }

    // Revenue Data
    const revenueData = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalPlatformFee: { $sum: '$platformFee' },
          totalCollegeRevenue: { $sum: '$collegeRevenue' }
        }
      }
    ]);

    const revenue = revenueData[0] || { totalRevenue: 0, totalPlatformFee: 0, totalCollegeRevenue: 0 };

    res.json({
      stats: {
        totalColleges,
        totalStudents,
        totalEvents,
        totalRegistrations,
        totalRevenue: revenue.totalRevenue,
        platformProfit: revenue.totalPlatformFee
      },
      recentRegistrations,
      growthData: growthData.map(d => ({ month: d._id, registrations: d.count })),
      dailyActivity: dailyActivity.map(d => ({ date: d._id, count: d.count })),
      collegeDistribution,
      categoryDistribution: categoryDistribution.map(c => ({ name: c._id || 'General', value: c.count })),
      settings
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// College Admin Stats
router.get('/college-stats', authMiddleware, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'college_admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const collegeId = req.user.college;

  try {
    const [totalDepts, totalStudents, totalEvents, totalRegistrations] = await Promise.all([
      Department.countDocuments({ college: collegeId }),
      User.countDocuments({ college: collegeId, role: 'student' }),
      Event.countDocuments({ college: collegeId }),
      Registration.countDocuments({ college: collegeId })
    ]);

    // Department-wise event data
    const deptStatsRaw = await Event.aggregate([
      { $match: { college: collegeId } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);

    // Populate department names
    const deptStats = await Promise.all(deptStatsRaw.map(async (stat) => {
      const dept = await Department.findById(stat._id);
      return { name: dept?.name || 'General', count: stat.count };
    }));

    // Venue-wise data
    const venueStats = await Event.aggregate([
      { $match: { college: collegeId } },
      { $group: { _id: '$venue', count: { $sum: 1 }, totalSeats: { $sum: '$seatLimit' }, registered: { $sum: '$registeredCount' } } }
    ]);

    res.json({
      stats: {
        totalDepts,
        totalStudents,
        totalEvents,
        totalRegistrations
      },
      deptStats,
      venueStats: venueStats.map(v => ({ name: v._id || 'TBD', count: v.count, capacity: v.totalSeats, registered: v.registered }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Audit Logs
router.get('/audit-logs', authMiddleware, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name email role');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update System Settings
router.patch('/settings', authMiddleware, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const settings = await SystemSettings.findOneAndUpdate({}, req.body, { new: true, upsert: true });
    await logAudit(req.user.id, 'UPDATE_SETTINGS', 'SYSTEM', JSON.stringify(req.body));
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Events (Super Admin)
router.get('/all-events', authMiddleware, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const events = await Event.find()
      .populate('college', 'name')
      .populate('organizer', 'name email')
      .sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Event Status (Moderation)
router.patch('/events/:id/status', authMiddleware, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const { status } = req.body;
    const event = await Event.findByIdAndUpdate(req.params.id, { status }, { new: true });
    await logAudit(req.user.id, 'MODERATE_EVENT', 'EVENT', `Updated event ${event?.title} status to ${status}`);
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Transactions
router.get('/transactions', authMiddleware, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const transactions = await Transaction.find()
      .populate('college', 'name')
      .populate('event', 'title')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get System Settings (Shared)
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;


