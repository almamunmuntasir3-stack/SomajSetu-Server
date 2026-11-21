import 'dotenv/config';
import { MongoClient } from 'mongodb';

let clientPromise = null;
let dbName = null;

// Singleton connection promise: every caller shares the same MongoClient.
export async function connectDB() {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    dbName = process.env.DB_NAME;

    if (!uri || !dbName) {
      throw new Error('MONGODB_URI and DB_NAME must be set in the environment.');
    }

    clientPromise = new MongoClient(uri)
      .connect()
      .then((client) => {
        console.log(`Connected to MongoDB Atlas (database: ${dbName}).`);
        return client;
      })
      .catch((error) => {
        clientPromise = null; // allow a later call to retry
        throw error;
      });
  }

  const client = await clientPromise;
  return client.db(dbName);
}

export async function closeDb() {
  const pending = clientPromise;
  clientPromise = null;

  if (!pending) return;

  const client = await pending.catch(() => null);
  if (client) await client.close();
}
