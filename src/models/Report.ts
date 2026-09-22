import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReport extends Document {
  quizId: string;
  questionId: string;
  issueType: string;
  description: string;
  userEmail: string;
  status: 'Pending' | 'Resolved';
  createdAt: Date;
}

const ReportSchema: Schema<IReport> = new Schema(
  {
    quizId: { type: String, required: true },
    questionId: { type: String, required: true },
    issueType: { type: String, required: true },
    description: { type: String, default: '' },
    userEmail: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Resolved'], default: 'Pending' },
  },
  { timestamps: true }
);

export const Report: Model<IReport> =
  mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema);
