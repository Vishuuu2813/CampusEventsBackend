import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { College } from '../models/College';
import { authMiddleware, AuthRequest } from '../middleware/auth';

import { AuditLog } from '../models/AuditLog';

const router = express.Router();

const ensureDatabaseConnected = (res: express.Response) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      message: 'Database is not connected. Configure MONGODB_URI and restart the backend server.',
    });
    return false;
  }
  return true;
};

// Helper to log audit actions
const logAudit = async (userId: string, action: string, module: 'COLLEGE' | 'USER' | 'EVENT' | 'SYSTEM' | 'AUTH', details: string) => {
  try {
    await AuditLog.create({ userId, action, module, details });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
};

const normalizeEmailDomain = (email: string) => {
  const parts = String(email || '').trim().toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
};

const findCollegeByDomain = async (domain: string) => {
  if (!domain) return null;

  // Exact match first
  let college = await College.findOne({ domain: new RegExp(`^${domain}$`, 'i') });
  if (college) return college;

  // If email is from subdomain (e.g. student.cs.jecrc.edu.in), try parent domains
  const segments = domain.split('.');
  for (let i = 1; i < segments.length - 1; i += 1) {
    const parent = segments.slice(i).join('.');
    // Avoid tiny suffixes
    if (parent.split('.').length < 2) continue;
    college = await College.findOne({ domain: new RegExp(`^${parent}$`, 'i') });
    if (college) return college;
  }

  return null;
};


router.post('/signup', async (req, res) => {
  try {
    if (!ensureDatabaseConnected(res)) return;

    const { name, email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    // Extract domain from email
    const domain = normalizeEmailDomain(email);
    if (!domain || !domain.endsWith('.edu')) {
      // For demo purposes, we might allow other domains if they are registered colleges
    }

    const college = await findCollegeByDomain(domain);
    
    // Super Admin check
    let role = 'student';
    if (email === 'vvishwas221@gmail.com') {
      role = 'super_admin';
    } else if (!college && domain.endsWith('.edu')) {
      // If it's a new .edu domain, maybe we don't auto-assign college
      // but for this SaaS, students MUST belong to a college
      return res.status(400).json({ message: 'Your college is not registered on this platform.' });
    }

    const user = new User({ 
      name, 
      email: normalizedEmail, 
      password, 
      role,
      college: college?._id 
    });
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role, college: user.college, email: user.email }, 
      process.env.JWT_SECRET || 'secret', 
      { expiresIn: '7d' }
    );
    res.status(201).json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        college: user.college
      } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    if (!ensureDatabaseConnected(res)) return;

    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').trim().toLowerCase() }).populate('college');
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await (user as any).comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // Auto-promote super admin if email matches
    if (user.email === 'vvishwas221@gmail.com' && user.role !== 'super_admin') {
      user.role = 'super_admin';
      await user.save();
    }

    // Auto-map student to college by email domain if missing
    if (user.role === 'student' && !user.college && user.email) {
      const domain = normalizeEmailDomain(user.email);
      const college = await findCollegeByDomain(domain);
      if (college) {
        user.college = college._id as any;
        await user.save();
      }
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, college: user.college?._id, email: user.email }, 
      process.env.JWT_SECRET || 'secret', 
      { expiresIn: '7d' }
    );
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        college: user.college
      } 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Super Admin: Search users by email or filter by college/dept
router.get('/search', authMiddleware, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'college_admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const { email, collegeId, departmentId, role } = req.query;
    const query: any = {};
    
    if (email) query.email = { $regex: email as string, $options: 'i' };
    if (collegeId) query.college = collegeId;
    if (departmentId) query.department = departmentId;
    
    // Super Admin should not view department-level admins
    if (req.user?.role === 'super_admin' || req.user?.role === 'admin') {
      if (role && ['dept_admin', 'spec_admin'].includes(role as string)) {
        return res.json([]);
      }
      query.role = role ? role : { $nin: ['dept_admin', 'spec_admin'] };
    } else {
      if (role) query.role = role;
    }

    const users = await User.find(query)
      .select('name email role college department')
      .limit(20);

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Super Admin: Impersonate user
router.post('/impersonate', authMiddleware, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const token = jwt.sign(
      { id: user._id, role: user.role, college: user.college, email: user.email, impersonatedBy: req.user.id }, 
      process.env.JWT_SECRET || 'secret', 
      { expiresIn: '1h' }
    );

    res.json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        college: user.college
      } 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Super Admin: Update User Role
router.patch('/users/:userId/role', authMiddleware, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.userId, { role }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });

    await logAudit(req.user.id, 'UPDATE_USER_ROLE', 'USER', `Updated user ${user.email} role to ${role}`);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Profile / Password
router.patch('/update-profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, departmentId, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user?.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (departmentId) user.department = departmentId;

    if (currentPassword && newPassword) {
      const isMatch = await (user as any).comparePassword(currentPassword);
      if (!isMatch) return res.status(400).json({ message: 'Incorrect current password' });
      user.password = newPassword;
    }

    await user.save();
    res.json({ message: 'Profile updated successfully', user: { name: user.name, department: user.department } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;



