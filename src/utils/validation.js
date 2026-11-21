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
