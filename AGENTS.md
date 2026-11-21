# AGENTS.md

## Layout & entrypoint
- Single-package ESM Node/Express API (`"type": "module"`); no workspaces.
- Entry: `src/server.js` (`main`, `npm start`). It awaits `connectDB()` before `app.listen()` and exits on connection failure; `src/config/db.js` exports `connectDB()` (cached MongoClient promise) and `closeDb()`.
- Routes in `src/routes/`, handlers in `src/controllers/`, shared checks in `src/utils/`. Collection names are literally `events` and `users`.
- No test, lint, typecheck, build, codegen, CI, or pre-commit config. Verify with `node --check <file>` plus HTTP smoke requests. `/health` pings MongoDB and returns `{ status: "ok", db: "connected", service: "shomajsetu-api" }`, or 503 when the ping fails.
- CORS allows a single origin: `process.env.CLIENT_URL || "http://localhost:3000"` with credentials.

## Conventions that aren't obvious
- `src/middleware/verifyJwt.js` verifies Bearer tokens with `jose`: first against the JWKS at `${AUTH_SERVER_URL || "http://localhost:3000"}/api/auth/jwks`, then falls back to HS256 with `JWT_SECRET`; it sets `req.user = { id, email, name, sub }`. All writes and both profile routes use it; the three `GET /api/events/...` routes are public.
- PATCH/DELETE ownership is checked against `req.user.email` only (case-insensitive), returning 403 `{ message: "Forbidden: You can only modify your own events" }`; body/header emails do not grant ownership.
- Join/leave identity is stored in `events.joinedVolunteers` as `email:<lowercased>` or `id:<lowercased>`; user stats also count raw-email entries. Emails are normalized to lowercase on writes.
- `dotenv/config` runs in both `src/server.js` and `src/config/db.js`. `.env` is gitignored; its `MONGODB_URI` currently uses a placeholder Atlas host (`cluster0.xxxxx.mongodb.net`), so startup fails with `ENOTFOUND` until a real URI is supplied.

## Commands & dependency state
- `npm start` → `node src/server.js`; `npm run dev` → `nodemon src/server.js` (nodemon 3.1.14 is installed and in the lockfile).
- `package.json` and `package-lock.json` now agree; installed versions include express 4.22.3, mongodb 6.22.0, dotenv 16.6.1, cors 2.8.6, jose 6.2.18, nodemon 3.1.14.
- Controllers use explicit `try/catch` + `next(error)` rather than relying on Express 5 promise handling, so they work on Express 4. Driver 6 still returns the document directly from `findOneAndUpdate`.
