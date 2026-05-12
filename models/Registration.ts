import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  college: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
  qrCode: { type: String }, // Base64 QR code string
  attended: { type: Boolean, default: false },
  reminderSent: { type: Boolean, default: false },
  registeredAt: { type: Date, default: Date.now },
});

// Ensure a user can only register once per event
registrationSchema.index({ event: 1, user: 1 }, { unique: true });

export const Registration = mongoose.model('Registration', registrationSchema);
