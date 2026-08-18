import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAttempt extends Document {
  userId?: string;
  userEmail?: string;
  userName?: string;
  userImage?: string;
  quizId: string;
  quizTitle: string;
  timestamp?: number;
  isFirstAttempt?: boolean;
  score: number;
  maxScore: number;
  accuracy: number;
  timeSpentSeconds: number;
  answeredCount: number;
  totalQuestions: number;
  userAnswers: Record<string, any>;
  createdAt: Date;
}

const AttemptSchema: Schema<IAttempt> = new Schema(
  {
    userId: { type: String, index: true },
    userEmail: { type: String, index: true },
    userName: { type: String, default: 'Candidate' },
    userImage: { type: String, default: '' },
    quizId: { type: String, required: true, index: true },
    quizTitle: { type: String, required: true },
    timestamp: { type: Number, index: true },
    isFirstAttempt: { type: Boolean, default: true, index: true },
    score: { type: Number, required: true },
    maxScore: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    timeSpentSeconds: { type: Number, required: true },
    answeredCount: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    userAnswers: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// High-performance compound indexes for sub-millisecond leaderboard & user profile lookups
AttemptSchema.index({ quizId: 1, isFirstAttempt: 1, score: -1, timeSpentSeconds: 1 });
AttemptSchema.index({ userEmail: 1, isFirstAttempt: 1 });
AttemptSchema.index({ createdAt: -1 });

// Auto-delete non-official practice retakes after 14 days (1,209,600s) to keep MongoDB storage lightweight
// (Official first attempts that impact the leaderboard remain permanent)
AttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1209600, partialFilterExpression: { isFirstAttempt: false } });

export const Attempt: Model<IAttempt> =
  mongoose.models.Attempt || mongoose.model<IAttempt>('Attempt', AttemptSchema);
