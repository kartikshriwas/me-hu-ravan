import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICourseResume {
  courseSlug: string;
  lastVideoId: string;
  lastVideoTitle: string;
  lastPlaybackTime: number;
  lastDuration: number;
  updatedAt: Date;
}

export interface IVideoPlayback {
  time: number;
  duration: number;
  completed: boolean;
  updatedAt: Date;
}

export interface IUserLearningProgress extends Document {
  userEmail: string;
  userId?: mongoose.Types.ObjectId;
  completedVideos: string[];
  totalVideosCompleted: number;
  currentStreak: number;
  longestStreak: number;
  lastStudiedDate: string; // YYYY-MM-DD
  lastStudiedAt: Date | null;
  studyDays: string[]; // Set of YYYY-MM-DD strings
  totalWatchTimeSeconds: number;
  coursesProgress: Map<string, ICourseResume>;
  videoPlayback: Map<string, IVideoPlayback>;
  createdAt: Date;
  updatedAt: Date;
}

const CourseResumeSchema = new Schema(
  {
    courseSlug: { type: String, required: true },
    lastVideoId: { type: String, required: true },
    lastVideoTitle: { type: String, default: '' },
    lastPlaybackTime: { type: Number, default: 0 },
    lastDuration: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const VideoPlaybackSchema = new Schema(
  {
    time: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserLearningProgressSchema: Schema<IUserLearningProgress> = new Schema(
  {
    userEmail: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      sparse: true,
    },
    completedVideos: {
      type: [String],
      default: [],
    },
    totalVideosCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastStudiedDate: {
      type: String,
      default: '',
    },
    lastStudiedAt: {
      type: Date,
      default: null,
    },
    studyDays: {
      type: [String],
      default: [],
    },
    totalWatchTimeSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    coursesProgress: {
      type: Map,
      of: CourseResumeSchema,
      default: () => new Map(),
    },
    videoPlayback: {
      type: Map,
      of: VideoPlaybackSchema,
      default: () => new Map(),
    },
  },
  { timestamps: true }
);

export const UserLearningProgress: Model<IUserLearningProgress> =
  mongoose.models.UserLearningProgress ||
  mongoose.model<IUserLearningProgress>('UserLearningProgress', UserLearningProgressSchema);
