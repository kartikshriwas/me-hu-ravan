import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserActivityLog extends Document {
  userEmail: string;
  dateStr: string; // YYYY-MM-DD
  activeSeconds: number;
  idleSeconds: number;
  focusSeconds: number;
  heartbeatsCount: number;
  lastActivePath: string;
  updatedAt: Date;
}

const UserActivityLogSchema: Schema<IUserActivityLog> = new Schema(
  {
    userEmail: { type: String, required: true, index: true },
    dateStr: { type: String, required: true, index: true },
    activeSeconds: { type: Number, default: 0 },
    idleSeconds: { type: Number, default: 0 },
    focusSeconds: { type: Number, default: 0 },
    heartbeatsCount: { type: Number, default: 0 },
    lastActivePath: { type: String, default: '/' },
  },
  { timestamps: true }
);

// Compound index for fast user daily usage lookup
UserActivityLogSchema.index({ userEmail: 1, dateStr: 1 }, { unique: true });

// Auto-delete daily activity logs older than 30 days (2,592,000s) to keep MongoDB storage minimal
UserActivityLogSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 2592000 });

export const UserActivityLog: Model<IUserActivityLog> =
  mongoose.models.UserActivityLog || mongoose.model<IUserActivityLog>('UserActivityLog', UserActivityLogSchema);
