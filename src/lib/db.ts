import mongoose from 'mongoose';

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

  // If connection exists and is ready (readyState 1)
  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  // Check if we need to start a new connection promise.
  // We only reuse an existing promise if it exists AND the connection state is either 1 (connected) or 2 (connecting).
  const readyState = cached.conn ? cached.conn.connection.readyState : 0;
  const isConnectingOrConnected = readyState === 1 || readyState === 2;

  if (!cached.promise || !isConnectingOrConnected) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 15,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000, // 5s timeout when cluster/network is down
      connectTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      family: 4, // Force IPv4 DNS lookup to prevent 5-10 second IPv6 timeout delays
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
    
    // Ensure the readyState is actually 1 (connected) before proceeding
    if (cached.conn.connection.readyState !== 1) {
      throw new Error(`Mongoose connection state is ${cached.conn.connection.readyState} instead of 1 (connected)`);
    }
  } catch (e) {
    console.error('Failed to connect to MongoDB:', e);
    cached.promise = null;
    cached.conn = null;
    throw e;
  }

  return cached.conn;
}
