import express from 'express';
import { College } from '../models/College';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = express.Router();

const toSlug = (value: string) =>
  (value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Super Admin: Create a new college and its initial admin
router.post('/', authMiddleware, async (req: any, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }

  try {
    const { name, domain, logo, address, slug, adminName, adminEmail, adminPassword } = req.body;
    
    // Check if college domain exists
    const existingCollege = await College.findOne({ domain });
    if (existingCollege) return res.status(400).json({ message: 'College with this domain already exists' });

    // Check if admin email exists
    if (adminEmail) {
      const existingUser = await User.findOne({ email: adminEmail });
      if (existingUser) return res.status(400).json({ message: 'Admin email already in use' });
    }

    const normalizedSlug = toSlug(slug || name);
    const existingSlug = await College.findOne({ slug: normalizedSlug });
    if (existingSlug) return res.status(400).json({ message: 'College slug already exists' });

    // Create College
    const college = new College({ name, slug: normalizedSlug, domain, logo, address });
    await college.save();

    // Create Admin if provided
    let adminUser = null;
    if (adminName && adminEmail && adminPassword) {
      adminUser = new User({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'college_admin',
        college: college._id
      });
      await adminUser.save();
    }

    // Log Audit
    await AuditLog.create({
      userId: req.user.id,
      action: 'CREATE_COLLEGE',
      module: 'COLLEGE',
      details: `Created college: ${name} (${domain})${adminUser ? ` with admin: ${adminEmail}` : ''}`
    });

    res.status(201).json({
      college,
      admin: adminUser ? { id: adminUser._id, name: adminUser.name, email: adminUser.email } : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public: Get college profile by slug + published events
router.get('/slug/:slug', async (req, res) => {
  try {
    const normalized = toSlug(req.params.slug);
    let college = await College.findOne({ slug: normalized }).lean();

    // Short URL: e.g. /college/jecrc when DB has slug "jecrc-university" (only if unambiguous)
    if (!college && normalized.length >= 2) {
      const pattern = new RegExp(`^${escapeRegex(normalized)}(-|$)`, 'i');
      const candidates = await College.find({ slug: pattern }).limit(5).lean();
      if (candidates.length === 1) {
        college = candidates[0];
      }
    }

    if (!college) return res.status(404).json({ message: 'College not found' });

    const { Event } = await import('../models/Event');
    const events = await Event.find({ college: college._id, status: 'published' })
      .sort({ date: 1 })
      .limit(30);

    res.json({ college, events });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Super Admin: Get all colleges
router.get('/', authMiddleware, async (req: any, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }

  try {
    const colleges = await College.find();
    res.json(colleges);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Super Admin: Assign College Admin
router.post('/assign-admin', authMiddleware, async (req: any, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }

  try {
    const { userId, collegeId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.role = 'college_admin';
    user.college = collegeId;
    await user.save();

    // Log Audit
    await AuditLog.create({
      userId: req.user.id,
      action: 'ASSIGN_COLLEGE_ADMIN',
      module: 'COLLEGE',
      details: `Assigned user ${user.email} as admin for college ${collegeId}`
    });

    res.json({ message: 'College Admin assigned successfully', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Super Admin: Update College Status
router.patch('/:id/status', authMiddleware, async (req: any, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }

  try {
    const { status } = req.body;
    const college = await College.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!college) return res.status(404).json({ message: 'College not found' });

    await AuditLog.create({
      userId: req.user.id,
      action: 'UPDATE_COLLEGE_STATUS',
      module: 'COLLEGE',
      details: `Updated college ${college.name} status to ${status}`
    });

    res.json(college);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Super Admin: Update College Features
router.patch('/:id/features', authMiddleware, async (req: any, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }

  try {
    const { features } = req.body;
    const college = await College.findByIdAndUpdate(req.params.id, { features }, { new: true });
    if (!college) return res.status(404).json({ message: 'College not found' });

    await AuditLog.create({
      userId: req.user.id,
      action: 'UPDATE_COLLEGE_FEATURES',
      module: 'COLLEGE',
      details: `Updated college ${college.name} features`
    });

    res.json(college);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Super Admin: Update college details (must be after /:id/status and /:id/features)
router.patch('/:id', authMiddleware, async (req: any, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }

  try {
    const college = await College.findById(req.params.id);
    if (!college) return res.status(404).json({ message: 'College not found' });

    const { name, slug, domain, address, about, logo } = req.body;

    if (domain !== undefined && domain !== college.domain) {
      const taken = await College.findOne({ domain, _id: { $ne: college._id } });
      if (taken) return res.status(400).json({ message: 'Domain already in use' });
      college.domain = domain;
    }

    if (slug !== undefined) {
      const normalizedSlug = toSlug(String(slug));
      const takenSlug = await College.findOne({ slug: normalizedSlug, _id: { $ne: college._id } });
      if (takenSlug) return res.status(400).json({ message: 'Slug already in use' });
      college.slug = normalizedSlug;
    }

    if (name !== undefined) college.name = name;
    if (address !== undefined) college.address = address;
    if (about !== undefined) college.about = about;
    if (logo !== undefined) college.logo = logo;

    await college.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'UPDATE_COLLEGE',
      module: 'COLLEGE',
      details: `Updated college ${college.name}`,
    });

    res.json(college);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

