const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

/**
 * TS `export default router` compiles to `exports.default = router`.
 * Plain `require()` then returns `{ default: router }`, which breaks `app.use()` with:
 * "Router.use() requires a middleware function but got a Object"
 */
function unwrapRouteModule(mod) {
  if (mod == null) return mod;
  const d = mod.default;
  if (d != null && typeof d.use === 'function') return d;
  if (typeof mod.use === 'function') return mod;
  return mod;
}

const authRoutes = unwrapRouteModule(require('./routes/authRoutes'));
const eventRoutes = unwrapRouteModule(require('./routes/eventRoutes'));
const registrationRoutes = unwrapRouteModule(require('./routes/registrationRoutes'));
const collegeRoutes = unwrapRouteModule(require('./routes/collegeRoutes'));
const departmentRoutes = unwrapRouteModule(require('./routes/departmentRoutes'));
const analyticsRoutes = unwrapRouteModule(require('./routes/analyticsRoutes'));
const collegeAdminRoutes = unwrapRouteModule(require('./routes/collegeAdminRoutes'));
const themeRoutes = unwrapRouteModule(require('./routes/themeRoutes'));

let cachedDb = null;

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

function mountApiRoutes(application) {
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

/** One Express app for serverless — do not call app.use() on every request. */
let serverlessAppPromise = null;

function getServerlessApp() {
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

module.exports = async function handler(req, res) {
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
};
