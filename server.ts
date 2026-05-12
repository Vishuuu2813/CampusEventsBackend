import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import type { Server } from 'node:http';
import authRoutes from './routes/authRoutes';
import eventRoutes from './routes/eventRoutes';
import registrationRoutes from './routes/registrationRoutes';
import collegeRoutes from './routes/collegeRoutes';
import departmentRoutes from './routes/departmentRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import collegeAdminRoutes from './routes/collegeAdminRoutes';
import themeRoutes from './routes/themeRoutes';
import { Event } from './models/Event';
import { Registration } from './models/Registration';
import { sendReminderEmail } from './services/emailService';

// Load environment variables
dotenv.config();

// MongoDB connection cache for serverless
let cachedDb: any = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }
  
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.warn('MONGODB_URI not found in environment variables.');
    return null;
  }
  
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    cachedDb = conn;
    console.log('Connected to MongoDB');
    return conn;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    return null;
  }
}

// Create Express app
const app = express();

// Configure Express app
async function configureApp() {
  // Middleware
  app.use(cors());
  app.use(express.json());

  // Connect to database
  await connectToDatabase();

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/registrations', registrationRoutes);
  app.use('/api/colleges', collegeRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/college-admin', collegeAdminRoutes);
  app.use('/api/theme', themeRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });

  // Simple response for root
  app.get('/', (_req, res) => {
    res
      .status(200)
      .type('text/plain')
      .send('Backend API is running. Use /api endpoints.');
  });

  return app;
}

// For Vercel deployment
export default async function handler(req: any, res: any) {
  try {
    const app = await configureApp();
    app(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Serverless function failed to execute'
    });
  }
}

// For local development with cron jobs and Vite
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 8080;

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Connect to database
  await connectToDatabase();

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/registrations', registrationRoutes);
  app.use('/api/colleges', collegeRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/college-admin', collegeAdminRoutes);
  app.use('/api/theme', themeRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });

  // Cron job for event reminders (only in local development)
  const cron = require('node-cron');
  cron.schedule('0 * * * *', async () => {
    console.log('Running event reminder cron job...');
    try {
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);
      
      const startWindow = new Date(tomorrow);
      startWindow.setMinutes(0, 0, 0);
      
      const endWindow = new Date(tomorrow);
      endWindow.setMinutes(59, 59, 999);

      // Find events happening in the 24h window
      const upcomingEvents = await Event.find({
        date: { $gte: startWindow, $lte: endWindow }
      });

      for (const event of upcomingEvents) {
        const registrations = await Registration.find({
          event: event._id,
          reminderSent: false
        }).populate('user', 'name email');

        for (const reg of registrations) {
          const user = reg.user as any;
          if (user && user.email) {
            await sendReminderEmail(user.email, user.name, event);
            reg.reminderSent = true;
            await reg.save();
          }
        }
      }
    } catch (err) {
      console.error('Cron job error:', err);
    }
  });

  // Frontend serving for local development
  if (process.env.VITE_MIDDLEWARE === 'true') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.get('/', (_req, res) => {
      res
        .status(200)
        .type('text/plain')
        .send('Backend is running. Start the frontend with `npm run dev`.');
    });
  }

  const server: Server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err?.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other server or change PORT in .env.`);
      process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
  });
}

// Start server only when running locally (not on Vercel)
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  startServer();
}
