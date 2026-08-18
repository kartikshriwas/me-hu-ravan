import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IQuestionStat extends Document {
  questionId: string;
  quizId: string;
  totalAttempts: number;
  firstAttemptTotal: number;
  correctCount: number;
  wrongCount: number;
  accuracyRate: number;
  updatedAt: Date;
}

const QuestionStatSchema: Schema<IQuestionStat> = new Schema(
  {
    questionId: { type: String, required: true, unique: true, index: true },
    quizId: { type: String, required: true, index: true },
    totalAttempts: { type: Number, default: 0 },
    firstAttemptTotal: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    accuracyRate: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const QuestionStat: Model<IQuestionStat> =
  mongoose.models.QuestionStat || mongoose.model<IQuestionStat>('QuestionStat', QuestionStatSchema);
