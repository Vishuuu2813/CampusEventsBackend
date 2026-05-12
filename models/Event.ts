import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  coverImage: { type: String, default: '' },
  galleryImages: { type: [String], default: [] },
  date: { type: Date, required: true },
  venue: { type: String, required: true },
  category: { type: String, required: true, default: 'General' },
  seatLimit: { type: Number, required: true },
  registeredCount: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'cancelled', 'flagged', 'moderated'], 
    default: 'published' 
  },
  isFeatured: { type: Boolean, default: false },
  isCrossCollege: { type: Boolean, default: false },
  college: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Event = mongoose.model('Event', eventSchema);
