import mongoose from 'mongoose';

const specializationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  college: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const Specialization = mongoose.model('Specialization', specializationSchema);
