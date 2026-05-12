import mongoose from 'mongoose';
import { User } from './models/User';
import dotenv from 'dotenv';
import dns from 'dns';

// Fix for mongodb+srv ENOTFOUND / ESERVFAIL DNS errors on certain ISPs
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config();

async function seed() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      console.error('MONGODB_URI not found');
      process.exit(1);
    }

    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'vvishwas221@gmail.com';

    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';
    const existingAdmin = await User.findOne({ email: superAdminEmail });

    if (existingAdmin) {
      console.log('User already exists, enforcing super_admin + resetting password...');
      existingAdmin.role = 'super_admin';
      // Reset password so login always works after running seed.
      // This will be hashed by the User pre-save hook.
      existingAdmin.password = superAdminPassword;
      await existingAdmin.save();
      console.log('Super Admin updated successfully');
      console.log(`Email: ${superAdminEmail}`);
      console.log(`Password: ${superAdminPassword}`);
    } else {
      const admin = new User({
        name: 'Super Admin',
        email: superAdminEmail,
        password: superAdminPassword, // Default password (or env override)
        role: 'super_admin'
      });
      await admin.save();
      console.log('Super Admin created successfully');
      console.log(`Email: ${superAdminEmail}`);
      console.log(`Password: ${superAdminPassword}`);
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
