import express from 'express';
import { Event } from '../models/Event';
import { Registration } from '../models/Registration';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import { sendCancellationEmail } from '../services/emailService';

const router = express.Router();

// Public: Get all events for a specific college (or all if not logged in)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    let query: any = {};
    
    if (token && token !== 'null') {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        if (decoded.role !== 'super_admin' && decoded.role !== 'admin' && decoded.college) {
           query.college = decoded.college;
        }
      } catch (err) {
         // Ignore invalid token, just return all
      }
    }

    const events = await Event.find(query).sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Public: Get single event
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Create event
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const allowedRoles = ['college_admin', 'dept_admin', 'super_admin', 'admin'];
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Unauthorized to create events' });
  }

  try {
    const { title, description, coverImage, galleryImages, date, venue, category, seatLimit, departmentId, status } = req.body;
    const event = new Event({
      title,
      description,
      coverImage: coverImage || '',
      galleryImages: Array.isArray(galleryImages) ? galleryImages.slice(0, 12) : [],
      date,
      venue,
      category,
      seatLimit,
      status: status || 'published',
      organizer: req.user.id,
      college: req.user.college,
      department: departmentId || (req.user.role === 'dept_admin' ? req.user.department : undefined)
    });
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Update event
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Delete event
router.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const eventTitle = event.title;
    const eventId = event._id;

    // Find all registered users for this event
    const registrations = await Registration.find({ event: eventId }).populate('user', 'name email');
    
    await Event.findByIdAndDelete(eventId);
    // Also delete registrations
    await Registration.deleteMany({ event: eventId });

    // Send cancellation emails
    registrations.forEach(reg => {
      const user = reg.user as any;
      if (user && user.email) {
        sendCancellationEmail(user.email, user.name, eventTitle).catch(err =>
          console.error('Failed to send cancellation email:', err)
        );
      }
    });

    res.json({ message: 'Event deleted and participants notified' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
