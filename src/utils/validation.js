import { ObjectId } from 'mongodb';

export function isValidObjectId(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-fA-F]{24}$/.test(value) &&
    ObjectId.isValid(value)
  );
}

export function toObjectId(value) {
  return new ObjectId(value);
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isEmail(value) {
  return isNonEmptyString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function parseFutureDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { error: 'eventDate must be a valid date.' };
  }
  if (date.getTime() <= Date.now()) {
    return { error: 'eventDate must be in the future.' };
  }

  return { date };
}

export function parsePositiveInt(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: 'maxVolunteers must be a positive integer.' };
  }

  return { value: parsed };
}

const FALLBACK_EVENT_IMAGE = '/images/event-placeholder.jpg';
const IMAGE_MAX_LENGTH = 2048;

// Used only when the client sends no usable image value.
export function defaultEventImage() {
  const configured = process.env.EVENT_DEFAULT_IMAGE;
  return typeof configured === 'string' && configured.trim()
    ? configured.trim()
    : FALLBACK_EVENT_IMAGE;
}

// Shared validator for image-like fields (event image/imageUrl, user
// avatar/image/imageUrl). Keys are checked in order and the first non-empty
// string wins, so an empty companion key cannot strip a valid client URL.
export function parseImageValue(body = {}, keys = [], fallback = '') {
  let value = '';

  for (const key of keys) {
    const candidate = body?.[key];
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate !== 'string') {
      return { error: `${key} must be a non-empty string URL.` };
    }
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    value = trimmed;
    break;
  }

  if (!value) return { value: fallback };
  const field = keys[0] || 'image';
  if (value.length > IMAGE_MAX_LENGTH) {
    return { error: `${field} must be at most ${IMAGE_MAX_LENGTH} characters.` };
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return { error: `${field} must not contain control characters.` };
  }
  if (/^javascript:/i.test(value)) {
    return { error: `${field} must not use the javascript: scheme.` };
  }

  return { value };
}

export function parseEventImage(body = {}) {
  return parseImageValue(body, ['image', 'imageUrl'], defaultEventImage());
}

// An empty avatar payload is a no-op, never an empty/broken stored value.
export function parseUserAvatar(body = {}) {
  return parseImageValue(body, ['avatar', 'image', 'imageUrl'], '');
}
