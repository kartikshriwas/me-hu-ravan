import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISessionEvent {
  timestamp: number;
  type: 'navigation' | 'state_change' | 'interaction';
  details: string;
}

export interface IUserSession extends Document {
  sessionId: string;
  userEmail: string;
  userName: string;
  userImage?: string;
  currentPath: string;
  pageTitle: string;
  state: 'active' | 'idle' | 'focus' | 'background';
  activeSeconds: number;
  idleSeconds: number;
  focusSeconds: number;
  lastHeartbeat: Date;
  startedAt: Date;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  screenResolution: string;
  networkType: string;
  recentEvents: ISessionEvent[];
  terminated: boolean;
  userAgent?: string;
  ipAddress?: string;
}

const SessionEventSchema = new Schema({
  timestamp: { type: Number, required: true },
  type: { type: String, enum: ['navigation', 'state_change', 'interaction'], default: 'navigation' },
  details: { type: String, default: '' },
}, { _id: false });

const UserSessionSchema: Schema<IUserSession> = new Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userEmail: { type: String, required: true, index: true },
    userName: { type: String, default: 'Guest User' },
    userImage: { type: String, default: '' },
    currentPath: { type: String, default: '/' },
    pageTitle: { type: String, default: 'PrepTea' },
    state: {
      type: String,
      enum: ['active', 'idle', 'focus', 'background'],
      default: 'active',
      index: true
    },
    activeSeconds: { type: Number, default: 0 },
    idleSeconds: { type: Number, default: 0 },
    focusSeconds: { type: Number, default: 0 },
    lastHeartbeat: { type: Date, default: Date.now, index: true },
    startedAt: { type: Date, default: Date.now },
    deviceType: { type: String, enum: ['desktop', 'mobile', 'tablet'], default: 'desktop' },
    browser: { type: String, default: 'Chrome' },
    os: { type: String, default: 'Linux' },
    screenResolution: { type: String, default: '1920x1080' },
    networkType: { type: String, default: '4g' },
    recentEvents: { type: [SessionEventSchema], default: [] },
    terminated: { type: Boolean, default: false },
    userAgent: { type: String, default: '' },
    ipAddress: { type: String, default: '' }
  },
  { timestamps: true }
);

// Ultra-fast TTL Index: Purge offline session records after 2 hours (7,200s) of inactivity to minimize MongoDB storage
UserSessionSchema.index({ lastHeartbeat: 1 }, { expireAfterSeconds: 7200 });

export const UserSession: Model<IUserSession> =
  mongoose.models.UserSession || mongoose.model<IUserSession>('UserSession', UserSessionSchema);
