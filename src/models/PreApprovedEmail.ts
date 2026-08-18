import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPreApprovedEmail extends Document {
  email: string;
  durationDays: number;
  addedBy: string;
  isActivated: boolean;
  activatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PreApprovedEmailSchema: Schema<IPreApprovedEmail> = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true },
    durationDays: { type: Number, required: true, default: 365 },
    addedBy: { type: String, required: true },
    isActivated: { type: Boolean, default: false },
    activatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const PreApprovedEmail: Model<IPreApprovedEmail> =
  mongoose.models.PreApprovedEmail || mongoose.model<IPreApprovedEmail>('PreApprovedEmail', PreApprovedEmailSchema);
