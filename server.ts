import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import type { Server } from 'node:http';
import type { Router } from 'express';
import authRoutesImport from './routes/authRoutes';
import eventRoutesImport from './routes/eventRoutes';
import registrationRoutesImport from './routes/registrationRoutes';
import collegeRoutesImport from './routes/collegeRoutes';
import departmentRoutesImport from './routes/departmentRoutes';
import analyticsRoutesImport from './routes/analyticsRoutes';
import collegeAdminRoutesImport from './routes/collegeAdminRoutes';
import themeRoutesImport from './routes/themeRoutes';
import { Event } from './models/Event';
import { Registration } from './models/Registration';

// Load environment variables
dotenv.config();

/** Vercel / some ESM loaders expose `default` as a nested property; Express needs the actual Router. */
function resolveRouter(mod: unknown): Router {
  const r =
    mod &&
    typeof mod === 'object' &&
    'default' in mod &&
    typeof (mod as { default: unknown }).default === 'function'
      ? (mod as { default: Router }).default
      : (mod as Router);
  if (!r || typeof (r as Router).use !== 'function') {
    throw new Error('Invalid route module: expected default export of express.Router()');
  }
  return r;
}

const authRoutes = resolveRouter(authRoutesImport);
const eventRoutes = resolveRouter(eventRoutesImport);
const registrationRoutes = resolveRouter(registrationRoutesImport);
const collegeRoutes = resolveRouter(collegeRoutesImport);
const departmentRoutes = resolveRouter(departmentRoutesImport);
const analyticsRoutes = resolveRouter(analyticsRoutesImport);
const collegeAdminRoutes = resolveRouter(collegeAdminRoutesImport);
const themeRoutes = resolveRouter(themeRoutesImport);

// MongoDB connection cache for serverless
let cachedDb: mongoose.Mongoose | null = null;

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

function mountApiRoutes(application: express.Application) {
  application.use('/api/auth', authRoutes);
  application.use('/api/events', eventRoutes);
  application.use('/api/registrations', registrationRoutes);
  application.use('/api/colleges', collegeRoutes);
  application.use('/api/departments', departmentRoutes);
  application.use('/api/analytics', analyticsRoutes);
  application.use('/api/college-admin', collegeAdminRoutes);
  application.use('/api/theme', themeRoutes);

  application.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });
}

// Serverless: one Express app, configured once (repeated app.use breaks Router mounting)
let serverlessAppPromise: Promise<express.Application> | null = null;

function getServerlessApp(): Promise<express.Application> {
  if (!serverlessAppPromise) {
    serverlessAppPromise = (async () => {
      const application = express();
      application.use(cors());
      application.use(express.json());
      await connectToDatabase();
      mountApiRoutes(application);
      application.get('/', (_req, res) => {
        res
          .status(200)
          .type('text/plain')
          .send('Backend API is running. Use /api endpoints.');
      });
      return application;
    })();
  }
  return serverlessAppPromise;
}

// For Vercel deployment
export default async function handler(req: express.Request, res: express.Response) {
  try {
    const application = await getServerlessApp();
    application(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    const message = error instanceof Error ? error.message : 'Serverless function failed to execute';
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Serverless function failed to execute',
      details: message,
    });
  }
}

// For local development with cron jobs and Vite
async function startServer() {
  const application = express();
  const PORT = Number(process.env.PORT) || 8080;

  application.use(cors());
  application.use(express.json());

  await connectToDatabase();
  mountApiRoutes(application);

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

      const upcomingEvents = await Event.find({
        date: { $gte: startWindow, $lte: endWindow },
      });

      for (const event of upcomingEvents) {
        const registrations = await Registration.find({
          event: event._id,
          reminderSent: false,
        }).populate('user', 'name email');

        for (const reg of registrations) {
          reg.reminderSent = true;
          await reg.save();
        }
      }
    } catch (err) {
      console.error('Cron job error:', err);
    }
  });

  if (process.env.VITE_MIDDLEWARE === 'true') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    application.use(vite.middlewares);
  } else {
    application.get('/', (_req, res) => {
      res
        .status(200)
        .type('text/plain')
        .send('Backend is running. Start the frontend with `npm run dev`.');
    });
  }

  const server: Server = application.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
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
