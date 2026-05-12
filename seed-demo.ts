import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';
import { College } from './models/College';
import { User } from './models/User';
import { Event } from './models/Event';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

const demoColleges = [
  {
    name: 'JECRC University',
    slug: 'jecrc-university',
    domain: 'jecrcu.edu.in',
    address: 'Jaipur, Rajasthan',
    about: 'A leading university focused on innovation, entrepreneurship, and campus life.',
    socialLinks: {
      instagram: 'https://instagram.com/jecrcuniversity',
      youtube: 'https://youtube.com/@jecrcuniversity',
      website: 'https://www.jecrcuniversity.edu.in',
    },
    theme: {
      primaryColor: '#6d28d9',
      secondaryColor: '#ec4899',
      headerStyle: 'glass',
      heroTitle: 'Welcome to JECRC University',
      heroSubtitle: 'Explore tech, culture, sports, and student life in one smart campus experience.',
      heroBanner: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1600&q=80',
    },
  },
  {
    name: 'ABC Institute of Technology',
    slug: 'abc-institute',
    domain: 'abc.edu.in',
    address: 'Noida, Uttar Pradesh',
    about: 'A modern tech-first institute with strong student communities and industry collaboration.',
    socialLinks: {
      instagram: 'https://instagram.com/abcinstitute',
      linkedin: 'https://linkedin.com/school/abcinstitute',
      website: 'https://abc.edu.in',
    },
    theme: {
      primaryColor: '#0ea5e9',
      secondaryColor: '#14b8a6',
      headerStyle: 'classic',
      heroTitle: 'ABC Institute Campus Hub',
      heroSubtitle: 'Workshops, hackathons, fests, and opportunities curated for every learner.',
      heroBanner: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=80',
    },
  },
  {
    name: 'Global School of Design',
    slug: 'global-design-school',
    domain: 'gsd.edu.in',
    address: 'Bengaluru, Karnataka',
    about: 'A design-driven campus known for creative showcases, exhibitions, and interdisciplinary events.',
    socialLinks: {
      instagram: 'https://instagram.com/gsdindia',
      facebook: 'https://facebook.com/gsdindia',
      website: 'https://gsd.edu.in',
    },
    theme: {
      primaryColor: '#f97316',
      secondaryColor: '#f43f5e',
      headerStyle: 'minimal',
      heroTitle: 'Create. Collaborate. Celebrate.',
      heroSubtitle: 'From design showcases to creator meetups, discover what is next on campus.',
      heroBanner: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1600&q=80',
    },
  },
  {
    name: 'North Valley College',
    slug: 'north-valley-college',
    domain: 'nvc.edu.in',
    address: 'Pune, Maharashtra',
    about: 'A student-centric college with active clubs, sports culture, and strong community participation.',
    socialLinks: {
      instagram: 'https://instagram.com/nvcampus',
      youtube: 'https://youtube.com/@nvcampus',
      website: 'https://nvc.edu.in',
    },
    theme: {
      primaryColor: '#22c55e',
      secondaryColor: '#3b82f6',
      headerStyle: 'glass',
      heroTitle: 'North Valley Campus Life',
      heroSubtitle: 'Join events, competitions, and student-led communities across the college.',
      heroBanner: 'https://images.unsplash.com/photo-1519452575417-564c1401ecc0?auto=format&fit=crop&w=1600&q=80',
    },
  },
];

async function upsertCollegeAdmin(collegeId: mongoose.Types.ObjectId, collegeName: string, domain: string) {
  const email = `admin@${domain}`;
  const password = 'Admin@123';

  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = 'college_admin';
    existing.college = collegeId;
    existing.password = password;
    await existing.save();
    return existing;
  }

  const admin = new User({
    name: `${collegeName} Admin`,
    email,
    password,
    role: 'college_admin',
    college: collegeId,
  });
  await admin.save();
  return admin;
}

async function upsertStudent(collegeId: mongoose.Types.ObjectId, domain: string) {
  const email = `student@${domain}`;
  const password = 'Student@123';

  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = 'student';
    existing.college = collegeId;
    existing.password = password;
    await existing.save();
    return existing;
  }

  const student = new User({
    name: 'Demo Student',
    email,
    password,
    role: 'student',
    college: collegeId,
  });
  await student.save();
  return student;
}

async function upsertEvent(collegeId: mongoose.Types.ObjectId, organizerId: mongoose.Types.ObjectId, collegeSlug: string, idx: number) {
  const title = `${collegeSlug.toUpperCase()} Campus Fest ${idx + 1}`;
  const existing = await Event.findOne({ title, college: collegeId });
  if (existing) {
    existing.status = 'published';
    existing.coverImage = `https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1400&q=80&sig=${idx + 11}`;
    existing.galleryImages = [
      `https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80&sig=${idx + 21}`,
      `https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80&sig=${idx + 31}`,
      `https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80&sig=${idx + 41}`,
    ];
    await existing.save();
    return existing;
  }

  const event = new Event({
    title,
    description:
      'A premium campus event experience with speaker sessions, competitions, workshops, and networking activities.',
    coverImage: `https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1400&q=80&sig=${idx + 11}`,
    galleryImages: [
      `https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80&sig=${idx + 21}`,
      `https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80&sig=${idx + 31}`,
      `https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80&sig=${idx + 41}`,
    ],
    date: new Date(Date.now() + (idx + 3) * 24 * 60 * 60 * 1000),
    venue: 'Main Auditorium',
    category: idx % 2 === 0 ? 'Technical' : 'Cultural',
    seatLimit: 250,
    status: 'published',
    organizer: organizerId,
    college: collegeId,
  });
  await event.save();
  return event;
}

async function run() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI not found');
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    for (let i = 0; i < demoColleges.length; i += 1) {
      const c = demoColleges[i];

      const existingCollege = await College.findOne({ $or: [{ domain: c.domain }, { slug: c.slug }] });
      let college: any;
      if (existingCollege) {
        existingCollege.name = c.name;
        existingCollege.slug = c.slug;
        existingCollege.domain = c.domain;
        existingCollege.address = c.address;
        existingCollege.about = c.about;
        existingCollege.socialLinks = {
          instagram: c.socialLinks.instagram || '',
          facebook: c.socialLinks.facebook || '',
          linkedin: c.socialLinks.linkedin || '',
          youtube: c.socialLinks.youtube || '',
          website: c.socialLinks.website || '',
        } as any;
        existingCollege.theme = {
          ...(existingCollege.theme || {}),
          ...(c.theme || {}),
          updatedAt: new Date(),
        } as any;
        existingCollege.storyHighlights = [
          `https://images.unsplash.com/photo-1519074002996-a69e7ac46a42?auto=format&fit=crop&w=500&q=80&sig=${i + 1}`,
          `https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=500&q=80&sig=${i + 101}`,
        ];
        existingCollege.galleryImages = [
          `https://images.unsplash.com/photo-1462536943532-57a629f6cc60?auto=format&fit=crop&w=1000&q=80&sig=${i + 201}`,
          `https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1000&q=80&sig=${i + 301}`,
          `https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1000&q=80&sig=${i + 401}`,
        ];
        await existingCollege.save();
        college = existingCollege;
      } else {
        college = new College({
          ...c,
          storyHighlights: [
            `https://images.unsplash.com/photo-1519074002996-a69e7ac46a42?auto=format&fit=crop&w=500&q=80&sig=${i + 1}`,
            `https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=500&q=80&sig=${i + 101}`,
          ],
          galleryImages: [
            `https://images.unsplash.com/photo-1462536943532-57a629f6cc60?auto=format&fit=crop&w=1000&q=80&sig=${i + 201}`,
            `https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1000&q=80&sig=${i + 301}`,
            `https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1000&q=80&sig=${i + 401}`,
          ],
        });
        await college.save();
      }

      const admin = await upsertCollegeAdmin(college._id as mongoose.Types.ObjectId, c.name, c.domain);
      await upsertStudent(college._id as mongoose.Types.ObjectId, c.domain);
      await upsertEvent(college._id as mongoose.Types.ObjectId, admin._id as mongoose.Types.ObjectId, c.slug, i);

      console.log(`Seeded college: ${c.name} (${c.slug})`);
      console.log(`  Admin login: admin@${c.domain} / Admin@123`);
      console.log(`  Student login: student@${c.domain} / Student@123`);
    }

    await mongoose.disconnect();
    console.log('Demo data seeded successfully');
  } catch (err) {
    console.error('seed-demo error:', err);
    process.exit(1);
  }
}

run();

