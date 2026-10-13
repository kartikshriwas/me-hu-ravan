import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGlobalSetting extends Document {
  key: string;
  freeUntil?: Date | null;
  autoDemoEnabled?: boolean;
  autoDemoDurationMinutes?: number;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GlobalSettingSchema: Schema<IGlobalSetting> = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global_config' },
    freeUntil: { type: Date, default: null },
    autoDemoEnabled: { type: Boolean, default: false },
    autoDemoDurationMinutes: { type: Number, default: 15 },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

export const GlobalSetting: Model<IGlobalSetting> =
  mongoose.models.GlobalSetting || mongoose.model<IGlobalSetting>('GlobalSetting', GlobalSettingSchema);
