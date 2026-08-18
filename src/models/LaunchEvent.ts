import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClaimedUser {
  userEmail: string;
  claimedAt: Date;
}

export interface ILaunchEvent extends Document {
  title: string;
  maxClaimCount: number;
  claimedCount: number;
  durationDays: number;
  isActive: boolean;
  claimedUsers: IClaimedUser[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const LaunchEventSchema: Schema<ILaunchEvent> = new Schema(
  {
    title: { type: String, required: true },
    maxClaimCount: { type: Number, required: true, default: 100 },
    claimedCount: { type: Number, default: 0 },
    durationDays: { type: Number, required: true, default: 365 },
    isActive: { type: Boolean, default: true },
    claimedUsers: [
      {
        userEmail: { type: String, required: true },
        claimedAt: { type: Date, default: Date.now },
      },
    ],
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const LaunchEvent: Model<ILaunchEvent> =
  mongoose.models.LaunchEvent || mongoose.model<ILaunchEvent>('LaunchEvent', LaunchEventSchema);
