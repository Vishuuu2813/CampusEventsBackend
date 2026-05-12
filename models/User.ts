import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['super_admin', 'college_admin', 'dept_admin', 'spec_admin', 'student', 'admin'], 
    default: 'student' 
  },
  college: { type: mongoose.Schema.Types.ObjectId, ref: 'College' },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  specialization: { type: mongoose.Schema.Types.ObjectId, ref: 'Specialization' },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

userSchema.pre('save', async function() {
  const user = this as any;
  if (!user.isModified('password')) return;
  user.password = await bcrypt.hash(user.password, 10);
});

userSchema.methods.comparePassword = async function(candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);
