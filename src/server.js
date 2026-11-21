import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { closeDb, getDb } from './config/db.js';
import eventsRoutes from './routes/events.routes.js';
import usersRoutes from './routes/users.routes.js';

const app = express();

const allowedOrigins = [process.env.CLIENT_URL, 'http://localhost:3000'].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
  }),
);
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'shomajsetu-api' });
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
const server = app.listen(PORT, () => {
  console.log(`ShomajSetu API listening on http://localhost:${PORT}`);
  getDb()
    .then(() => console.log('MongoDB connected.'))
    .catch((error) => console.error('MongoDB connection failed:', error.message));
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
