# AGENTS.md

## Layout & entrypoint
- Single-package ESM Node/Express API (`"type": "module"`); no workspaces.
- Entry: `src/server.js` (`main`, `npm start`). It awaits `connectDB()` before `app.listen()` and exits on connection failure; `src/config/db.js` exports `connectDB()` (cached MongoClient promise) and `closeDb()`.
- Routes in `src/routes/`, handlers in `src/controllers/`, shared checks in `src/utils/`. Collection names are literally `events` and `users`.
- No test, lint, typecheck, build, codegen, CI, or pre-commit config. Verify with `node --check <file>` plus HTTP smoke requests. `/health` pings MongoDB and returns `{ status: "ok", db: "connected", service: "shomajsetu-api" }`, or 503 when the ping fails.
- CORS allows a single origin: `process.env.CLIENT_URL || "http://localhost:3000"` with credentials.

## Conventions that aren't obvious
- `src/middleware/verifyJwt.js` verifies Bearer tokens with `jose`: first against the JWKS at `${AUTH_SERVER_URL || "http://localhost:3000"}/api/auth/jwks`, then falls back to HS256 with `JWT_SECRET`; it sets `req.user = { id, email, name, sub }`. All writes, both profile routes, and the joined-events reads use it; only `GET /api/events/upcoming|latest|:id` are public.
- PATCH/DELETE ownership is checked against `req.user.email` only (case-insensitive), returning 403 `{ message: "Forbidden: You can only modify your own events" }`; body/header emails do not grant ownership.
- `src/utils/volunteerIdentity.js` is the single source of truth for join identity: JWT claims win over body/header values, and joins store one `email:<lowercased>` or `id:<lowercased>` string in `events.joinedVolunteers`. Reads (`GET /api/events/joined-events`, alias `/joined`, and profile stats) match raw and prefixed email/id forms. Never reintroduce body-first identity lookup — that caused joins to be stored under a different key than the read query.
- Static GET routes must stay above `router.get('/:id')` in `events.routes.js`, or they are parsed as ObjectIds.
- `dotenv/config` runs in both `src/server.js` and `src/config/db.js`. `.env` is gitignored and now points at a working Atlas cluster.

## Commands & dependency state
- `npm start` → `node src/server.js`; `npm run dev` → `nodemon src/server.js` (nodemon 3.1.14 is installed and in the lockfile).
- `package.json` and `package-lock.json` now agree; installed versions include express 4.22.3, mongodb 6.22.0, dotenv 16.6.1, cors 2.8.6, jose 6.2.18, nodemon 3.1.14.
- Controllers use explicit `try/catch` + `next(error)` rather than relying on Express 5 promise handling, so they work on Express 4. Driver 6 still returns the document directly from `findOneAndUpdate`.
