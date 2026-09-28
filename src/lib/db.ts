import mongoose from 'mongoose';
import dns from 'dns';

// Fix Linux querySrv ETIMEOUT by forcing reliable public DNS resolvers and IPv4 order
try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
  if (typeof dns.setServers === 'function') {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1']);
  }
} catch (e) {
  // Ignore in environments where custom DNS servers cannot be set
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
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      family: 4, // Force IPv4 DNS lookup to prevent IPv6 timeout delays
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      cached.conn = m;
      return m;
    }).catch((err) => {
      cached.promise = null;
      cached.conn = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
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
      cached.promise = null;
      cached.conn = null;
      throw new Error(`MongoDB connection failed (readyState: ${state})`);
    }
  }

  return cached.conn;
}
