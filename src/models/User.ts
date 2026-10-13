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
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
