import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema({
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  globalBanner: {
    message: String,
    active: { type: Boolean, default: false },
    type: { type: String, enum: ['info', 'warning', 'error'], default: 'info' }
  },
  registrationEnabled: {
    type: Boolean,
    default: true
  },
  maxEventsPerCollege: {
    type: Number,
    default: 100
  },
  platformName: {
    type: String,
    default: 'CampusSaaS'
  },
  globalCommissionRate: {
    type: Number,
    default: 5
  },
  paymentGateway: {
    provider: { type: String, default: 'Stripe' },
    active: { type: Boolean, default: true }
  },
  eventCategories: {
    type: [String],
    default: ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'General']
  }
}, { timestamps: true });

export const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
