import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  image?: string;
  googleId?: string;
  role: 'superadmin' | 'admin' | 'user';
  adminPermissions: string[];
  allowedBatches?: string[];
  isPremium: boolean;
  premiumExpiresAt?: Date | null;
  premiumPlan?: string;
  grantedBy?: string;
  totalScore: number;
  testsCompleted: number;
  averageAccuracy: number;
  lastActiveAt: Date;
  createdAt: Date;
  hasCourseAccess?: boolean;
  hasHadDemoOrPremium?: boolean;
  isAlt?: boolean;
  altOfEmail?: string;
  altReason?: string;
  normalizedEmail?: string;
  deviceIds?: string[];
  hardwareFingerprint?: string;
  lastIp?: string;
  pastIps?: string[];
}

const UserSchema: Schema<IUser> = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    googleId: { type: String, default: '' },
    role: { type: String, enum: ['superadmin', 'admin', 'user'], default: 'user' },
    adminPermissions: { type: [String], default: [] },
    allowedBatches: { type: [String], default: [] },
    isPremium: { type: Boolean, default: false },
    premiumExpiresAt: { type: Date, default: null },
    premiumPlan: { type: String, default: 'free' },
    grantedBy: { type: String, default: '' },
    totalScore: { type: Number, default: 0 },
    testsCompleted: { type: Number, default: 0 },
    averageAccuracy: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
    hasCourseAccess: { type: Boolean, default: false },
    hasHadDemoOrPremium: { type: Boolean, default: false },
    isAlt: { type: Boolean, default: false },
    altOfEmail: { type: String, default: '' },
    altReason: { type: String, default: '' },
    normalizedEmail: { type: String, default: '', index: true },
    deviceIds: { type: [String], default: [] },
    hardwareFingerprint: { type: String, default: '' },
    lastIp: { type: String, default: '' },
    pastIps: { type: [String], default: [] },
  },
  { timestamps: true }
);

UserSchema.index({ pastIps: 1 });
UserSchema.index({ lastIp: 1 });
UserSchema.index({ isAlt: 1 });
UserSchema.index({ normalizedEmail: 1 });
UserSchema.index({ deviceIds: 1 });
UserSchema.index({ hardwareFingerprint: 1 });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
