import express from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Department } from '../models/Department';
import { Specialization } from '../models/Specialization';
import { User } from '../models/User';
import { Event } from '../models/Event';
import { College } from '../models/College';
import { Transaction } from '../models/Transaction';
import { AuditLog } from '../models/AuditLog';

const router = express.Router();

// Helper to log audit actions
const logAudit = async (userId: string, action: string, module: string, details: string) => {
  try {
    await AuditLog.create({ userId, action, module, details });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
};

// Middleware to ensure user is a college admin
const isCollegeAdmin = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'college_admin') {
    return res.status(403).json({ message: 'College Admin access required' });
  }
  next();
};

// --- Department & Specialization Management ---

// Create Department
router.post('/departments', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    const department = new Department({
      name,
      description,
      college: req.user?.college
    });
    await department.save();
    await logAudit(req.user?.id!, 'CREATE_DEPARTMENT', 'COLLEGE', `Created department ${name}`);
    res.status(201).json(department);
  } catch (err: any) {
    console.error('Error creating department:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Get all departments in college
router.get('/departments', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const departments = await Department.find({ college: req.user?.college });
    res.json(departments);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit Department
router.patch('/departments/:id', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    const department = await Department.findOne({ _id: req.params.id, college: req.user?.college });
    if (!department) return res.status(404).json({ message: 'Department not found' });

    if (name) department.name = name;
    if (description !== undefined) department.description = description;

    await department.save();
    await logAudit(req.user?.id!, 'UPDATE_DEPARTMENT', 'COLLEGE', `Updated department ${department.name}`);
    res.json(department);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Department
router.delete('/departments/:id', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const department = await Department.findOneAndDelete({ _id: req.params.id, college: req.user?.college });
    if (!department) return res.status(404).json({ message: 'Department not found' });
    await logAudit(req.user?.id!, 'DELETE_DEPARTMENT', 'COLLEGE', `Deleted department ${department.name}`);
    res.json({ message: 'Department deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create Specialization
router.post('/specializations', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, departmentId, description } = req.body;
    const specialization = new Specialization({
      name,
      department: departmentId,
      college: req.user?.college,
      description
    });
    await specialization.save();
    await logAudit(req.user?.id!, 'CREATE_SPECIALIZATION', 'COLLEGE', `Created specialization ${name}`);
    res.status(201).json(specialization);
  } catch (err: any) {
    console.error('Error creating specialization:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Get all specializations in college
router.get('/specializations', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const specializations = await Specialization.find({ college: req.user?.college }).populate('department', 'name');
    res.json(specializations);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- User Management ---

// Get all users in college
router.get('/users', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const users = await User.find({ college: req.user?.college })
      .populate('department', 'name')
      .populate('specialization', 'name')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new user (e.g. Department Admin) in the college
router.post('/users', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, email, password, role, department, specialization } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    
    const allowedRoles = ['student', 'dept_admin', 'spec_admin'];
    const desiredRole = role || 'student';
    if (!allowedRoles.includes(desiredRole)) {
      return res.status(400).json({ message: 'Invalid role for college user creation' });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User with this email already exists' });

    let departmentId: any = undefined;
    let specializationId: any = undefined;

    if (desiredRole === 'dept_admin' || desiredRole === 'spec_admin') {
      if (!department) return res.status(400).json({ message: 'Department is required for admin roles' });
      const dept = await Department.findOne({ _id: department, college: req.user?.college });
      if (!dept) return res.status(400).json({ message: 'Invalid department for this college' });
      departmentId = dept._id;
    }

    if (desiredRole === 'spec_admin') {
      if (!specialization) return res.status(400).json({ message: 'Specialization is required for specialization admin' });
      const spec = await Specialization.findOne({ _id: specialization, college: req.user?.college, department: departmentId });
      if (!spec) return res.status(400).json({ message: 'Invalid specialization for this department' });
      specializationId = spec._id;
    }

    const user = new User({
      name,
      email,
      password,
      role: desiredRole,
      college: req.user?.college,
      department: departmentId,
      specialization: specializationId
    });
    
    await user.save();
    await logAudit(req.user?.id!, 'CREATE_USER', 'USER', `Created user ${email} with role ${user.role}`);
    res.status(201).json(user);
  } catch (err: any) {
    console.error('Error creating user:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Update user role/department/specialization
router.patch('/users/:id', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const { role, department, specialization } = req.body;
    const user = await User.findById(req.params.id);
    if (!user || user.college?.toString() !== req.user?.college?.toString()) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (role) user.role = role;

    if (role === 'student' || role === 'college_admin' || role === 'admin' || role === 'super_admin') {
      user.department = undefined;
      user.specialization = undefined;
    } else if (role === 'dept_admin') {
      user.department = department;
      user.specialization = undefined;
    } else if (role === 'spec_admin') {
      user.department = department;
      user.specialization = specialization;
    } else {
      if (department !== undefined) user.department = department || undefined;
      if (specialization !== undefined) user.specialization = specialization || undefined;
    }

    await user.save();
    await logAudit(req.user?.id!, 'UPDATE_USER', 'USER', `Updated user ${user.email} permissions`);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Event Management ---

// Get all events in college
router.get('/events', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const events = await Event.find({ college: req.user?.college })
      .populate('department', 'name')
      .populate('organizer', 'name email')
      .sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update event status (Approval/Moderation)
router.patch('/events/:id/status', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    const event = await Event.findById(req.params.id);
    if (!event || event.college?.toString() !== req.user?.college?.toString()) {
      return res.status(404).json({ message: 'Event not found' });
    }

    event.status = status;
    await event.save();
    await logAudit(req.user?.id!, 'MODERATE_EVENT', 'EVENT', `Updated event ${event.title} status to ${status}`);
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Payments & Revenue ---

// Get all transactions in college
router.get('/transactions', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const transactions = await Transaction.find({ college: req.user?.college })
      .populate('event', 'title')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- College Settings & Branding ---

// Get college settings
router.get('/settings', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const college = await College.findById(req.user?.college);
    res.json(college);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update college settings
router.patch('/settings', authMiddleware, isCollegeAdmin, async (req: AuthRequest, res) => {
  try {
    const college = await College.findByIdAndUpdate(req.user?.college, req.body, { new: true });
    await logAudit(req.user?.id!, 'UPDATE_COLLEGE_SETTINGS', 'COLLEGE', `Updated college branding/settings`);
    res.json(college);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
