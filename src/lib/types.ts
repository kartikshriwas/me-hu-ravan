export interface CourseMeta {
  title: string;
  slug: string;
  filename: string;
  keywords?: string | null;
  description?: string | null;
  access?: string;
  price?: number;
  courseImage?: {
    url?: string | null;
    name?: string | null;
  } | null;
  sectionsCount: number;
  unitsCount: number;
  videosCount: number;
  totalDurationSeconds?: number;
  isOngoing?: boolean;
}

export interface CourseSectionUnit {
  id: string;
  type: string;
  icon?: string;
  subtitle?: string;
  unitTitle?: string;
  title?: string;
  description?: string;
  access?: string;
  data?: {
    assessmentId?: string;
    quizId?: string;
    embed?: string;
    default?: boolean;
  };
  questionsCount?: number;
  hasData?: boolean;
  sourceid?: string;
  vimeoid?: string;
  fileUrl?: string;
  duration?: number;
  modifiedF?: string;
}

export interface CourseSection {
  id: string;
  title: string;
  description?: string;
  access?: string;
  units: CourseSectionUnit[];
}

export interface CourseDetail extends CourseMeta {
  sections: CourseSection[];
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface QuestionBlock {
  id: string;
  type: string;
  questionNumber: number;
  htmlText: string;
  options: QuestionOption[];
  correctOptionId: string | null;
  correctOptionText: string | null;
  explanationHtml: string | null;
  score: number;
  totalAttempts?: number;
  accuracyRate?: number;
}

export interface AssessmentMeta {
  id: string;
  title: string;
  quizId: string;
  assessmentId?: string;
  objectId?: string;
  quizType?: string;
  description: string;
  timeLimitSeconds: number;
  questionTimeLimitSeconds: number;
  totalQuestions: number;
  totalScore: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Practice';
  candidateCount?: number;
  avgAccuracy?: number;
}

export interface AssessmentDetail extends AssessmentMeta {
  questions: QuestionBlock[];
}

export interface QuizUserAnswer {
  questionId: string;
  selectedOptionId: string | null;
  isMarkedForReview: boolean;
  timeSpentSeconds: number;
}

export interface QuizAttemptResult {
  quizId: string;
  quizTitle: string;
  timestamp: number;
  isFirstAttempt?: boolean;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  score: number;
  maxScore: number;
  accuracy: number; // percentage
  timeSpentSeconds: number;
  userAnswers: Record<string, QuizUserAnswer>;
}
