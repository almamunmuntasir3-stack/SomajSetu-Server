import { connectDB } from '../config/db.js';
import { apiError } from '../utils/apiError.js';
import {
  escapeRegex,
  isEmail,
  isNonEmptyString,
  isValidObjectId,
  parseFutureDate,
  parsePositiveInt,
  toObjectId,
} from '../utils/validation.js';
import { joinedVolunteersFilter, primaryIdentity } from '../utils/volunteerIdentity.js';

const COLLECTION = 'events';

const eventsCollection = async () => (await connectDB()).collection(COLLECTION);

function requireObjectId(id) {
  if (!isValidObjectId(id)) throw apiError(400, 'Invalid event id.');
  return toObjectId(id);
}

function forbidIfNotOrganizer(event, req, res) {
  const email = req.user?.email;
  const isOwner =
    typeof email === 'string' &&
    email.trim().toLowerCase() === String(event.organizerEmail ?? '').trim().toLowerCase();

  if (isOwner) return false;

  res.status(403).json({ message: 'Forbidden: You can only modify your own events' });
  return true;
}

export async function getUpcomingEvents(req, res, next) {
  try {
    const filter = { eventDate: { $gt: new Date() } };

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: pattern }, { location: pattern }, { description: pattern }];
    }

    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    if (category && category.toLowerCase() !== 'all') {
      filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
    }

    const results = await (await eventsCollection())
      .find(filter)
      .sort({ eventDate: 1 })
      .toArray();

    res.json(results);
  } catch (error) {
    next(error);
  }
}

export async function getLatestEvents(req, res, next) {
  try {
    const results = await (await eventsCollection())
      .find({ eventDate: { $gt: new Date() } })
      .sort({ eventDate: 1 })
      .limit(6)
      .toArray();

    res.json(results);
  } catch (error) {
    next(error);
  }
}

export async function getJoinedEvents(req, res, next) {
  try {
    const filter = {
      ...joinedVolunteersFilter(req),
      eventDate: { $gt: new Date() },
    };

    const results = await (await eventsCollection())
      .find(filter)
      .sort({ eventDate: 1 })
      .toArray();

    res.json(results);
  } catch (error) {
    next(error);
  }
}

export async function getEventById(req, res, next) {
  try {
    const _id = requireObjectId(req.params.id);
    const event = await (await eventsCollection()).findOne({ _id });

    if (!event) throw apiError(404, 'Event not found.');

    res.json(event);
  } catch (error) {
    next(error);
  }
}

export async function createEvent(req, res, next) {
  try {
    const body = req.body ?? {};
    const required = [
      'title',
      'category',
      'description',
      'location',
      'eventDate',
      'maxVolunteers',
      'organizerEmail',
      'organizerName',
    ];
    const missing = required.filter(
      (field) =>
        body[field] === undefined ||
        body[field] === null ||
        (typeof body[field] === 'string' && body[field].trim() === ''),
    );

    if (missing.length) {
      throw apiError(400, `Missing or empty required fields: ${missing.join(', ')}.`);
    }
    for (const field of ['title', 'category', 'description', 'location', 'organizerEmail', 'organizerName']) {
      if (!isNonEmptyString(body[field])) throw apiError(400, `${field} must be a non-empty string.`);
    }
    if (!isEmail(body.organizerEmail)) {
      throw apiError(400, 'organizerEmail must be a valid email address.');
    }

    const parsedDate = parseFutureDate(body.eventDate);
    if (parsedDate.error) throw apiError(400, parsedDate.error);

    const parsedCapacity = parsePositiveInt(body.maxVolunteers);
    if (parsedCapacity.error) throw apiError(400, parsedCapacity.error);

    const event = {
      title: body.title.trim(),
      category: body.category.trim(),
      description: body.description.trim(),
      location: body.location.trim(),
      eventDate: parsedDate.date,
      maxVolunteers: parsedCapacity.value,
      organizerEmail: body.organizerEmail.trim().toLowerCase(),
      organizerName: body.organizerName.trim(),
      joinedVolunteers: [],
      createdAt: new Date(),
    };

    const result = await (await eventsCollection()).insertOne(event);

    res.status(201).json({ message: 'Event created.', event: { ...event, _id: result.insertedId } });
  } catch (error) {
    next(error);
  }
}

export async function updateEvent(req, res, next) {
  try {
    const _id = requireObjectId(req.params.id);
    const collection = await eventsCollection();
    const event = await collection.findOne({ _id });

    if (!event) throw apiError(404, 'Event not found.');
    if (forbidIfNotOrganizer(event, req, res)) return;

    const body = req.body ?? {};
    const updates = {};

    for (const field of ['title', 'category', 'description', 'location', 'organizerName']) {
      if (body[field] !== undefined) {
        if (!isNonEmptyString(body[field])) throw apiError(400, `${field} must be a non-empty string.`);
        updates[field] = body[field].trim();
      }
    }

    if (body.eventDate !== undefined) {
      const parsed = parseFutureDate(body.eventDate);
      if (parsed.error) throw apiError(400, parsed.error);
      updates.eventDate = parsed.date;
    }

    if (body.maxVolunteers !== undefined) {
      const parsed = parsePositiveInt(body.maxVolunteers);
      if (parsed.error) throw apiError(400, parsed.error);
      if (parsed.value < (event.joinedVolunteers?.length ?? 0)) {
        throw apiError(400, 'maxVolunteers cannot be lower than the number of volunteers already joined.');
      }
      updates.maxVolunteers = parsed.value;
    }

    if (!Object.keys(updates).length) {
      throw apiError(400, 'No updatable fields were provided.');
    }

    await collection.updateOne({ _id }, { $set: updates });
    const updated = await collection.findOne({ _id });

    res.json({ message: 'Event updated.', event: updated });
  } catch (error) {
    next(error);
  }
}

export async function deleteEvent(req, res, next) {
  try {
    const _id = requireObjectId(req.params.id);
    const collection = await eventsCollection();
    const event = await collection.findOne({ _id });

    if (!event) throw apiError(404, 'Event not found.');
    if (forbidIfNotOrganizer(event, req, res)) return;

    await collection.deleteOne({ _id });

    res.json({ message: 'Event deleted.' });
  } catch (error) {
    next(error);
  }
}

export async function joinEvent(req, res, next) {
  try {
    const _id = requireObjectId(req.params.id);
    const identity = primaryIdentity(req);

    if (!identity) {
      throw apiError(400, 'A userEmail or userId is required to join an event.');
    }

    const collection = await eventsCollection();
    const event = await collection.findOne({ _id });
    if (!event) throw apiError(404, 'Event not found.');
    if (new Date(event.eventDate).getTime() <= Date.now()) {
      throw apiError(400, 'Cannot join an event that has already started or ended.');
    }

    const joined = event.joinedVolunteers ?? [];
    if (joined.includes(identity)) throw apiError(409, 'You have already joined this event.');
    if (joined.length >= event.maxVolunteers) throw apiError(409, 'This event is full.');

    // The filter keeps the capacity/duplicate checks atomic under concurrent joins.
    const updated = await collection.findOneAndUpdate(
      {
        _id,
        eventDate: { $gt: new Date() },
        joinedVolunteers: { $ne: identity },
        $expr: { $lt: [{ $size: { $ifNull: ['$joinedVolunteers', []] } }, '$maxVolunteers'] },
      },
      { $addToSet: { joinedVolunteers: identity } },
      { returnDocument: 'after' },
    );

    if (!updated) throw apiError(409, 'This event is full or you have already joined it.');

    res.json({ message: 'Joined event.', event: updated });
  } catch (error) {
    next(error);
  }
}

export async function leaveEvent(req, res, next) {
  try {
    const _id = requireObjectId(req.params.id);
    const identity = primaryIdentity(req);

    if (!identity) {
      throw apiError(400, 'A userEmail or userId is required to leave an event.');
    }

    const collection = await eventsCollection();
    const updated = await collection.findOneAndUpdate(
      { _id, joinedVolunteers: identity },
      { $pull: { joinedVolunteers: identity } },
      { returnDocument: 'after' },
    );

    if (!updated) {
      const exists = await collection.findOne({ _id }, { projection: { _id: 1 } });
      if (!exists) throw apiError(404, 'Event not found.');
      throw apiError(409, 'You have not joined this event.');
    }

    res.json({ message: 'Left event.', event: updated });
  } catch (error) {
    next(error);
  }
}
