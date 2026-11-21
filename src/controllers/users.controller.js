import { connectDB } from '../config/db.js';
import { apiError } from '../utils/apiError.js';
import { escapeRegex, isEmail } from '../utils/validation.js';

const USERS = 'users';
const EVENTS = 'events';
const PROFILE_FIELDS = ['name', 'bio', 'phone', 'location', 'avatar'];

function canonicalEmail(req) {
  const email = req.params?.email;
  if (!isEmail(email)) throw apiError(400, 'A valid email address is required.');
  return email.trim().toLowerCase();
}

function emailFilter(email) {
  return { email: new RegExp(`^${escapeRegex(email)}$`, 'i') };
}

async function volunteerStats(email) {
  const db = await connectDB();
  const events = db.collection(EVENTS);
  const joined = { joinedVolunteers: { $in: [email, `email:${email}`] } };

  const [eventsHosted, eventsJoined, upcomingJoined] = await Promise.all([
    events.countDocuments({ organizerEmail: new RegExp(`^${escapeRegex(email)}$`, 'i') }),
    events.countDocuments(joined),
    events.countDocuments({ ...joined, eventDate: { $gt: new Date() } }),
  ]);

  return { eventsHosted, eventsJoined, upcomingJoined };
}

async function profileResponse(user, email) {
  const stored = {};
  for (const field of PROFILE_FIELDS) stored[field] = user?.[field] ?? '';
  return { ...stored, email, stats: await volunteerStats(email) };
}

export async function getUserProfile(req, res, next) {
  try {
    const email = canonicalEmail(req);
    const user = await (await connectDB()).collection(USERS).findOne(emailFilter(email));
    res.json(await profileResponse(user, email));
  } catch (error) {
    next(error);
  }
}

export async function updateUserProfile(req, res, next) {
  try {
    const email = canonicalEmail(req);
    const body = req.body ?? {};
    const updates = {};

    for (const field of PROFILE_FIELDS) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== 'string') throw apiError(400, `${field} must be a string.`);
        updates[field] = body[field].trim();
      }
    }

    const users = (await connectDB()).collection(USERS);

    if (Object.keys(updates).length) {
      await users.updateOne(
        emailFilter(email),
        {
          $set: { ...updates, email, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );
    }

    const user = await users.findOne(emailFilter(email));
    res.json(await profileResponse(user, email));
  } catch (error) {
    next(error);
  }
}
