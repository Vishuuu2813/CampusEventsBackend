import mongoose from 'mongoose';
import { Event } from './models/Event';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

async function seedEvents() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) throw new Error('MONGODB_URI not found');

    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const dummyEvents = [
      {
        title: 'Tech Innovation Summit 2024',
        description: 'Join industry leaders for a day of inspiring talks on AI, Web3, and the future of software engineering.',
        date: new Date('2024-11-15T09:00:00Z'),
        venue: 'Main Auditorium',
        category: 'Tech',
        seatLimit: 500,
        registeredCount: 320,
        status: 'published',
        createdBy: new mongoose.Types.ObjectId(),
        organizer: new mongoose.Types.ObjectId(),
        college: new mongoose.Types.ObjectId()
      },
      {
        title: 'Annual Cultural Fest: Resonance',
        description: 'Experience the magic of music, dance, and art at our biggest cultural extravaganza of the year!',
        date: new Date('2024-12-05T18:00:00Z'),
        venue: 'Open Air Theater',
        category: 'Cultural',
        seatLimit: 1000,
        registeredCount: 850,
        status: 'published',
        createdBy: new mongoose.Types.ObjectId(),
        organizer: new mongoose.Types.ObjectId(),
        college: new mongoose.Types.ObjectId()
      },
      {
        title: 'Inter-College Basketball Tournament',
        description: 'Cheer for your college team as they battle it out for the ultimate championship trophy.',
        date: new Date('2024-10-28T10:00:00Z'),
        venue: 'Sports Complex',
        category: 'Sports',
        seatLimit: 200,
        registeredCount: 150,
        status: 'published',
        createdBy: new mongoose.Types.ObjectId(),
        organizer: new mongoose.Types.ObjectId(),
        college: new mongoose.Types.ObjectId()
      },
      {
        title: 'Introduction to Machine Learning',
        description: 'A hands-on workshop covering the basics of ML using Python and TensorFlow. Laptops required.',
        date: new Date('2024-11-02T14:00:00Z'),
        venue: 'Computer Lab 3',
        category: 'Tech',
        seatLimit: 50,
        registeredCount: 50, // Sold out
        status: 'published',
        createdBy: new mongoose.Types.ObjectId(),
        organizer: new mongoose.Types.ObjectId(),
        college: new mongoose.Types.ObjectId()
      }
    ];

    await Event.insertMany(dummyEvents);
    console.log('Dummy events seeded successfully!');
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Seed error:', err);
  }
}

seedEvents();
