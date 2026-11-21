import { isEmail } from './validation.js';

function cleanString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

// JWT claims are authoritative. Body/header values are only a fallback for
// legacy clients that have no usable identity in the token.
export function identityFromRequest(req) {
  const emails = [];
  const ids = [];

  const claimEmail = cleanString(req.user?.email);
  if (claimEmail && isEmail(claimEmail)) emails.push(claimEmail.toLowerCase());

  for (const claim of [req.user?.id, req.user?.sub, req.user?._id]) {
    const id = cleanString(claim);
    if (id) ids.push(id.toLowerCase());
  }

  if (!emails.length && !ids.length) {
    for (const value of [req.body?.userEmail, req.headers?.['x-user-email']]) {
      const email = cleanString(value);
      if (email && isEmail(email)) emails.push(email.toLowerCase());
    }
    for (const value of [req.body?.userId, req.headers?.['x-user-id']]) {
      const id = cleanString(value);
      if (id) ids.push(id.toLowerCase());
    }
  }

  return { emails: [...new Set(emails)], ids: [...new Set(ids)] };
}

// One deterministic value is written to events.joinedVolunteers on join.
export function primaryIdentity(req) {
  const { emails, ids } = identityFromRequest(req);
  if (emails.length) return `email:${emails[0]}`;
  if (ids.length) return `id:${ids[0]}`;
  return null;
}

// Every form that could have been written for this user: prefixed ids/emails
// and legacy raw email strings. Shared by reads, duplicate checks and leave.
export function joinedVolunteerValues(req) {
  const { emails, ids } = identityFromRequest(req);
  const values = [];

  for (const email of emails) values.push(email, `email:${email}`);
  for (const id of ids) values.push(id, `id:${id}`);

  return [...new Set(values)];
}

// Reads must recognize every form that could have been written for this user.
export function joinedVolunteersFilter(req) {
  return { joinedVolunteers: { $in: joinedVolunteerValues(req) } };
}
