import { connectDB } from '../config/db.js';
import { apiError } from '../utils/apiError.js';
import { escapeRegex, isEmail, parseUserAvatar } from '../utils/validation.js';
import { identityFromRequest } from '../utils/volunteerIdentity.js';

const USERS = 'users';
const EVENTS = 'events';
const PROFILE_FIELDS = ['name', 'bio', 'phone', 'location'];
const AVATAR_KEYS = ['avatar', 'image', 'imageUrl'];

function canonicalEmail(req) {
  const email = req.params?.email;
  if (!isEmail(email)) throw apiError(400, 'A valid email address is required.');
  return email.trim().toLowerCase();
}

function emailFilter(email) {
  return { email: new RegExp(`^${escapeRegex(email)}$`, 'i') };
}

async function volunteerStats(req, email) {
  const db = await connectDB();
  const events = db.collection(EVENTS);

  const joinedValues = [email, `email:${email}`];
  // Token ids only describe the signed-in user; never count them toward a
  // different profile's stats.
  const requesterEmail = typeof req.user?.email === 'string' ? req.user.email.trim().toLowerCase() : '';
  if (requesterEmail === email) {
    for (const id of identityFromRequest(req).ids) joinedValues.push(id, `id:${id}`);
  }
  const joined = { joinedVolunteers: { $in: joinedValues } };

  const [eventsHosted, eventsJoined, upcomingJoined] = await Promise.all([
    events.countDocuments({ organizerEmail: new RegExp(`^${escapeRegex(email)}$`, 'i') }),
    events.countDocuments(joined),
    events.countDocuments({ ...joined, eventDate: { $gt: new Date() } }),
  ]);

  return { eventsHosted, eventsJoined, upcomingJoined };
}

async function profileResponse(req, user, email) {
  const stored = {};
  for (const field of PROFILE_FIELDS) stored[field] = user?.[field] ?? '';

  // Promote a legacy image/imageUrl value, but prefer the canonical avatar.
  const image = [user?.avatar, user?.image, user?.imageUrl].find(
    (value) => typeof value === 'string' && value.trim(),
  );
  const avatar = image ? image.trim() : '';
  return {
    ...stored,
    avatar,
    image: avatar,
    imageUrl: avatar,
    email,
    stats: await volunteerStats(req, email),
  };
}

export async function getUserProfile(req, res, next) {
  try {
    const email = canonicalEmail(req);
    const user = await (await connectDB()).collection(USERS).findOne(emailFilter(email));
    res.json(await profileResponse(req, user, email));
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

    // Validate image-like keys with the shared rules. An empty payload leaves
    // the stored avatar alone instead of persisting '' or stripping a valid URL.
    if (AVATAR_KEYS.some((key) => body[key] !== undefined)) {
      const parsed = parseUserAvatar(body);
      if (parsed.error) throw apiError(400, parsed.error);
      if (parsed.value) updates.avatar = parsed.value;
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
    res.json(await profileResponse(req, user, email));
  } catch (error) {
    next(error);
  }
}
