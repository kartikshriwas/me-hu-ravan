import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRedeemCodeUserUsage {
  userEmail: string;
  usedAt: Date;
}

export interface IRedeemCode extends Document {
  code: string;
  durationDays: number;
  maxUses: number;
  usedCount: number;
  usedBy: IRedeemCodeUserUsage[];
  expiresAt?: Date | null;
  createdBy: string;
  batchName?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RedeemCodeSchema: Schema<IRedeemCode> = new Schema(
  {
    code: { type: String, required: true, unique: true, index: true, uppercase: true },
    durationDays: { type: Number, required: true, default: 365 },
    maxUses: { type: Number, required: true, default: 1 },
    usedCount: { type: Number, default: 0 },
    usedBy: [
      {
        userEmail: { type: String, required: true },
        usedAt: { type: Date, default: Date.now },
      },
    ],
    expiresAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
    batchName: { type: String, default: 'General' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const RedeemCode: Model<IRedeemCode> =
  mongoose.models.RedeemCode || mongoose.model<IRedeemCode>('RedeemCode', RedeemCodeSchema);
