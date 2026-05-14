import express from 'express';
import QRCode from 'qrcode';
import { Registration } from '../models/Registration';
import { Event } from '../models/Event';
import { User } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Student: Register for an event
router.post('/register', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { eventId } = req.body;
    const userId = req.user?.id;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Multi-tenant check: Student must belong to the same college as the event
    if (req.user?.role === 'student' && event.college.toString() !== req.user?.college) {
      return res.status(403).json({ message: 'You can only register for events in your college' });
    }

    if (event.registeredCount >= event.seatLimit) {
      return res.status(400).json({ message: 'Event is full' });
    }

    const existingRegistration = await Registration.findOne({ event: eventId, user: userId });
    if (existingRegistration) {
      return res.status(400).json({ message: 'Already registered for this event' });
    }

    // Generate QR Code
    const user = await User.findById(userId);
    const qrData = JSON.stringify({ 
      registrationId: '', // Will be updated after save if needed, but IDs are enough for lookup
      eventId, 
      userId, 
      userName: user?.name,
      userEmail: user?.email,
      eventTitle: event.title,
      eventDate: event.date,
      collegeId: event.college,
      timestamp: Date.now() 
    });
    const qrCode = await QRCode.toDataURL(qrData);

    const registration = new Registration({
      event: eventId,
      user: userId,
      college: event.college,
      qrCode
    });

    await registration.save();
    
    // Optionally update QR code with registration ID if needed for absolute uniqueness in offline scenarios
    const finalQrData = JSON.stringify({ 
      registrationId: registration._id,
      eventId, 
      userId, 
      userName: user?.name,
      userEmail: user?.email,
      eventTitle: event.title,
      eventDate: event.date,
      collegeId: event.college,
      timestamp: Date.now() 
    });
    registration.qrCode = await QRCode.toDataURL(finalQrData);
    await registration.save();

    // Update event registered count
    event.registeredCount += 1;
    await event.save();

    res.status(201).json(registration);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// User: Get my registrations
router.get('/my', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const registrations = await Registration.find({ user: req.user?.id }).populate('event');
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get event participants
router.get('/event/:eventId', authMiddleware, async (req, res) => {
  try {
    const registrations = await Registration.find({ event: req.params.eventId }).populate('user', 'name email');
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Mark attendance
router.post('/attendance', authMiddleware, async (req, res) => {
  try {
    const { registrationId } = req.body;
    const registration = await Registration.findById(registrationId);
    if (!registration) return res.status(404).json({ message: 'Registration not found' });

    registration.attended = true;
    await registration.save();
    res.json(registration);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
