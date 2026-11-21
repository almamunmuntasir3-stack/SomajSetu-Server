import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks;

function getJwks() {
  if (!jwks) {
    const authServerUrl = process.env.AUTH_SERVER_URL || 'http://localhost:3000';
    jwks = createRemoteJWKSet(new URL(`${authServerUrl}/api/auth/jwks`));
  }
  return jwks;
}

function unauthorized(res, message) {
  return res.status(401).json({ message });
}

export async function verifyJwt(req, res, next) {
  const authorization = req.headers.authorization;

  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return unauthorized(res, 'Unauthorized: Missing token');
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return unauthorized(res, 'Unauthorized: Missing token');

  let payload;

  try {
    ({ payload } = await jwtVerify(token, getJwks()));
  } catch {
    const secret = process.env.JWT_SECRET;
    if (!secret) return unauthorized(res, 'Unauthorized: Invalid or expired token');

    try {
      ({ payload } = await jwtVerify(token, new TextEncoder().encode(secret)));
    } catch {
      return unauthorized(res, 'Unauthorized: Invalid or expired token');
    }
  }

  req.user = {
    id: payload.id,
    _id: payload._id,
    email: payload.email,
    name: payload.name,
    sub: payload.sub,
  };

  return next();
}

export default verifyJwt;
