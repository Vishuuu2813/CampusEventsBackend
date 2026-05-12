const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const collegeRoutes = require('./routes/collegeRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const collegeAdminRoutes = require('./routes/collegeAdminRoutes');
const themeRoutes = require('./routes/themeRoutes');

// Load environment variables
dotenv.config();

// MongoDB connection cache for serverless
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
module.exports = async function handler(req, res) {
  try {
    // Log environment variables for debugging
    console.log('Environment check:', {
      MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Missing',
      JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Missing',
      NODE_ENV: process.env.NODE_ENV || 'Not set'
    });

    const app = await configureApp();
    app(req, res);
  } catch (error) {
    console.error('Handler error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Serverless function failed to execute',
      details: error.message
    });
  }
};
