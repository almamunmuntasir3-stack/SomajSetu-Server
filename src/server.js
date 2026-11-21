import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { closeDb, connectDB } from './config/db.js';
import eventsRoutes from './routes/events.routes.js';
import usersRoutes from './routes/users.routes.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    const db = await connectDB();
    await db.admin().ping();
    res.json({ status: 'ok', db: 'connected', service: 'shomajsetu-api' });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    res.status(503).json({ status: 'error', db: 'disconnected', service: 'shomajsetu-api' });
  }
});

app.use('/api/events', eventsRoutes);
app.use('/api/users', usersRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) ? err.status : 500;
  if (status === 500) console.error(err);

  res.status(status).json({ error: status === 500 ? 'Internal server error.' : err.message });
});

const PORT = Number(process.env.PORT) || 5000;
let server;

async function start() {
  try {
    await connectDB();
    server = app.listen(PORT, () => {
      console.log(`ShomajSetu API listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB Atlas:', error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);

  if (!server) {
    await closeDb();
    process.exit(0);
    return;
  }

  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

await start();
