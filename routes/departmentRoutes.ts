import express from 'express';
import { Department } from '../models/Department';
import { User } from '../models/User';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// College Admin: Create a department
router.post('/', authMiddleware, async (req: any, res) => {
  if (req.user.role !== 'college_admin') {
    return res.status(403).json({ message: 'College Admin access required' });
  }

  try {
    const { name, description } = req.body;
    const department = new Department({
      name,
      description,
      college: req.user.college
    });
    await department.save();
    res.status(201).json(department);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// College Admin: Get all departments in their college
router.get('/', authMiddleware, async (req: any, res) => {
  try {
    const collegeId = req.user.college;
    const departments = await Department.find({ college: collegeId });
    res.json(departments);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// College Admin: Assign Department Admin
router.post('/assign-dept-admin', authMiddleware, async (req: any, res) => {
  if (req.user.role !== 'college_admin') {
    return res.status(403).json({ message: 'College Admin access required' });
  }

  try {
    const { userId, deptId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.role = 'dept_admin';
    user.college = req.user.college;
    user.department = deptId;
    await user.save();

    res.json({ message: 'Department Admin assigned successfully', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
