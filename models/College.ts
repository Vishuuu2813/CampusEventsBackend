import mongoose from 'mongoose';

const collegeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  domain: { type: String, required: true, unique: true }, // e.g., jecrc.edu
  logo: { type: String },
  address: { type: String },
  about: { type: String, default: '' },
  storyHighlights: { type: [String], default: [] },
  galleryImages: { type: [String], default: [] },
  socialLinks: {
    instagram: { type: String, default: '' },
    facebook: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    youtube: { type: String, default: '' },
    website: { type: String, default: '' },
  },
  theme: {
    primaryColor: { type: String, default: '#6366f1' },
    secondaryColor: { type: String, default: '#a855f7' },
    favicon: { type: String, default: '' },
    heroBanner: { type: String, default: '' },
    typography: { type: String, default: '' },
    headerStyle: { type: String, enum: ['minimal', 'glass', 'classic'], default: 'glass' },
    heroTitle: { type: String, default: '' },
    heroSubtitle: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
  },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'pending', 'suspended'], 
    default: 'active' 
  },
  isVerified: { type: Boolean, default: false },
  commissionRate: { type: Number, default: 5 }, // Percentage
  features: {
    payments: { type: Boolean, default: true },
    certificates: { type: Boolean, default: true },
    qrCheckin: { type: Boolean, default: true },
    customThemes: { type: Boolean, default: false }
  },
  tier: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  createdAt: { type: Date, default: Date.now },
});

export const College = mongoose.model('College', collegeSchema);
