import mongoose from 'mongoose';
import dns from 'dns';

// Force IPv4 lookup order to avoid IPv6 timeouts
try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (e) {
  // Ignore in environments where custom DNS order cannot be set
}

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function resetDatabaseConnection(): Promise<void> {
  cached.conn = null;
  cached.promise = null;
  if (global.mongooseCache) {
    global.mongooseCache.conn = null;
    global.mongooseCache.promise = null;
  }
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  } catch (_) {
    // Ignore disconnect errors
  }
}

// Attach lifecycle listeners once to automatically invalidate cache on network drops
if (!(global as any).mongooseListenersAttached) {
  mongoose.connection.on('error', (err) => {
    console.warn('[MongoDB] Connection error detected, invalidating cache:', err.message);
    cached.conn = null;
    cached.promise = null;
    if (global.mongooseCache) {
      global.mongooseCache.conn = null;
      global.mongooseCache.promise = null;
    }
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected from database, invalidating cache');
    cached.conn = null;
    cached.promise = null;
    if (global.mongooseCache) {
      global.mongooseCache.conn = null;
      global.mongooseCache.promise = null;
    }
  });

  (global as any).mongooseListenersAttached = true;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  // 1. If active connection exists and readyState is 1 (connected), return immediately
  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  // 2. If connection is in a failed/disconnected state (0 or 3), reset cached promise
  const currentReadyState = cached.conn ? cached.conn.connection.readyState : mongoose.connection.readyState;
  if (currentReadyState === 0 || currentReadyState === 3) {
    cached.promise = null;
    cached.conn = null;
  }

  // 3. Initiate a single connection promise if none is currently pending
  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      cached.conn = m;
      return m;
    }).catch(async (err) => {
      await resetDatabaseConnection();
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    await resetDatabaseConnection();
    throw e;
  }

  // 4. Verify connection is connected (readyState 1). If state 2 (connecting), wait briefly for open event
  if (!cached.conn || cached.conn.connection.readyState !== 1) {
    if (cached.conn && cached.conn.connection.readyState === 2) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 3000);
        cached.conn?.connection.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    const state = cached.conn ? cached.conn.connection.readyState : 0;
    if (state !== 1) {
      await resetDatabaseConnection();
      throw new Error(`MongoDB connection failed (readyState: ${state})`);
    }
  }

  return cached.conn;
}
