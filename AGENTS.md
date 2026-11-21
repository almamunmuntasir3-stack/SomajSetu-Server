# AGENTS.md

## Layout & entrypoint
- Single-package ESM Node/Express API (`"type": "module"`); no workspaces.
- Entry: `src/server.js` (`main`, `npm start`). `src/config/db.js` exports `getDb()` (lazy, cached `MongoClient`) and `closeDb()`.
- Routes in `src/routes/`, handlers in `src/controllers/`, shared checks in `src/utils/`. Collection names are literally `events` and `users`.
- No test, lint, typecheck, build, codegen, CI, or pre-commit config. Verify with `node --check <file>` plus HTTP smoke requests; `/health` returns `{ status: "ok", service: "shomajsetu-api" }`.

## Conventions that aren't obvious
- There is no auth middleware. Ownership for PATCH/DELETE is inferred from `body.userEmail`, `body.organizerEmail`, `x-user-email`, or `req.user.email`, compared to `event.organizerEmail`.
- Join/leave identity is stored in `events.joinedVolunteers` as `email:<lowercased>` or `id:<lowercased>`; user stats also count raw-email entries. Emails are normalized to lowercase on writes.
- `dotenv/config` runs in both `src/server.js` and `src/config/db.js`. `.env` is gitignored but still holds placeholders (`MONGODB_URI=your_mongodb_atlas_connection_string`, `JWT_SECRET=replace_with_a_strong_random_secret`) — set real values locally.

## Commands & dependency gotcha
- `npm start` → `node src/server.js`; `npm run dev` → `nodemon src/server.js` — dev is broken because `nodemon` is declared in `package.json` but absent from `package-lock.json` and `node_modules`.
- `package.json` disagrees with the lockfile/installed modules: it declares name `shomajsetu-server`, express `^4.21.0`, mongodb `^6.10.0`, dotenv `^16.4.5`, cors `^2.8.5`, nodemon `^3.1.7`; installed/locked are `somajsetu-server`, express `5.3.0`, mongodb `7.9.1`, dotenv `18.0.10`, cors `2.8.6`, no nodemon.
- Code targets the installed versions (Express 5, driver 7: `findOneAndUpdate` returns the document directly). `npm ls --depth=0` exits non-zero; don't run a plain `npm install` to "fix" this without intending to rewrite the lockfile and change dependency versions.
