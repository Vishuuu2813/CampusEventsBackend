import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  college: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const Department = mongoose.model('Department', departmentSchema);
