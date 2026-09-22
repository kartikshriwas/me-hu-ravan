'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AssessmentDetail, QuizAttemptResult, QuestionBlock } from '@/lib/types';
import { getQuizHistory, saveQuizAttempt, isQuizMatch, cleanQuizId, isQuestionBookmarked, toggleBookmark } from '@/lib/storage';
import { QuestionRenderer } from '@/components/QuestionRenderer';
import { useAuth } from '@/lib/authContext';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import { SignInRequired } from '@/components/SignInRequired';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  Target, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  RotateCcw, 
  ArrowLeft, 
  Filter, 
  BookOpenCheck,
  Bookmark,
  Lock
} from 'lucide-react';

export default function QuizResultsPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId: rawQuizId } = use(params);
  const quizId = cleanQuizId(rawQuizId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const timestampParam = searchParams.get('t');
  const { user, loading: authLoading } = useAuth();

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [attempt, setAttempt] = useState<QuizAttemptResult | null>(null);
  const [loading, setLoading] = useState(true);

  const [filterMode, setFilterMode] = useState<'all' | 'correct' | 'incorrect' | 'bookmarked'>('all');
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});

  const fetchedKeyRef = useRef<string>('');

  useEffect(() => {
    async function loadData() {
      if (!user) {
        setLoading(false);
        return;
      }
      const key = `${quizId}-${timestampParam || ''}-${user.email}`;
      if (fetchedKeyRef.current === key) return;
      fetchedKeyRef.current = key;

      try {
        setLoading(true);

        // Fetch assessment questions & explanations
        const res = await fetch(`/api/questions/${encodeURIComponent(quizId)}?includeAnswers=true`);
        const json = await res.json();
        if (json.success) {
          setAssessment(json.data);

          // Initial bookmarks map
          const bMap: Record<string, boolean> = {};
          json.data.questions.forEach((q: QuestionBlock) => {
            bMap[q.id] = isQuestionBookmarked(q.id, user.email);
          });
          setBookmarkedMap(bMap);
        }

        // Fetch attempt: First check local storage using flexible quizId matching
        const history = getQuizHistory(user.email);
        let targetAttempt: QuizAttemptResult | undefined;

        if (timestampParam) {
          const tNum = parseInt(timestampParam, 10);
          targetAttempt = history.find((a) => isQuizMatch(a.quizId, quizId) && a.timestamp === tNum);
        }
        if (!targetAttempt) {
          targetAttempt = history.find((a) => isQuizMatch(a.quizId, quizId));
        }

        // Fallback: If attempt is not found in local storage, query MongoDB backend API
        if (!targetAttempt) {
          try {
            const apiRes = await fetch(
              `/api/attempts?quizId=${encodeURIComponent(quizId)}${timestampParam ? `&t=${timestampParam}` : ''}`
            );
            const apiJson = await apiRes.json();
            if (apiJson.success && apiJson.attempt) {
              const remote = apiJson.attempt;
              targetAttempt = {
                quizId: remote.quizId,
                quizTitle: remote.quizTitle,
                timestamp: remote.timestamp || new Date(remote.createdAt).getTime(),
                totalQuestions: remote.totalQuestions,
                answeredCount: remote.answeredCount,
                correctCount: remote.correctCount || 0,
                incorrectCount: remote.incorrectCount || 0,
                unansweredCount: remote.unansweredCount || 0,
                score: remote.score,
                maxScore: remote.maxScore,
                accuracy: remote.accuracy,
                timeSpentSeconds: remote.timeSpentSeconds,
                userAnswers: remote.userAnswers || {}
              };
              saveQuizAttempt(targetAttempt, user.email);
            }
          } catch (apiErr) {
            console.error('Error fetching attempt fallback from backend:', apiErr);
          }
        }

        if (targetAttempt) {
          if (json.data && Array.isArray(json.data.questions)) {
            let verifiedCorrect = 0;
            let verifiedIncorrect = 0;
            let verifiedUnanswered = 0;
            let verifiedScore = 0;

            json.data.questions.forEach((q: QuestionBlock) => {
              const uAns = targetAttempt.userAnswers ? targetAttempt.userAnswers[q.id] : null;
              if (uAns && uAns.selectedOptionId) {
                const isCorrect =
                  uAns.selectedOptionId === q.correctOptionId ||
                  (q.correctOptionText &&
                    uAns.selectedOptionId === q.options.find((o) => o.text.trim() === q.correctOptionText?.trim())?.id);

                if (isCorrect) {
                  verifiedCorrect++;
                  verifiedScore += (q.score || 1);
                } else {
                  verifiedIncorrect++;
                }
              } else {
                verifiedUnanswered++;
              }
            });

            const verifiedAnswered = verifiedCorrect + verifiedIncorrect;
            const verifiedAccuracy = verifiedAnswered > 0 ? Math.round((verifiedCorrect / verifiedAnswered) * 100) : 0;

            targetAttempt.score = verifiedScore;
            targetAttempt.maxScore = json.data.totalScore || targetAttempt.maxScore;
            targetAttempt.correctCount = verifiedCorrect;
            targetAttempt.incorrectCount = verifiedIncorrect;
            targetAttempt.unansweredCount = verifiedUnanswered;
            targetAttempt.accuracy = verifiedAccuracy;

            saveQuizAttempt(targetAttempt, user.email);
          }

          setAttempt(targetAttempt);
          // Trigger celebratory confetti if score is >= 50%
          if (targetAttempt.accuracy >= 50) {
            confetti({
              particleCount: 75,
              spread: 70,
              origin: { y: 0.6 }
            });
          }
        }
      } catch (err) {
        console.error('Error loading result data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [quizId, timestampParam, user]);

  if (loading || authLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Calculating assessment performance...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <SignInRequired
        title="Sign In to View Results"
        subtitle="Authentication is required to view your test results, score breakdown, and answer solutions."
        testTitle={assessment?.title}
      />
    );
  }

  if (!assessment || !attempt) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-4">
        <h2 className="text-xl font-bold text-foreground">No result record found for this test</h2>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold"
        >
          Return to Practice Tests
        </button>
      </div>
    );
  }

  const formatTimeSpent = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleToggleBookmark = (question: QuestionBlock) => {
    if (!assessment) return;
    const isBookmarked = toggleBookmark(assessment.quizId, assessment.title, question, user?.email);
    setBookmarkedMap((prev) => ({
      ...prev,
      [question.id]: isBookmarked
    }));
  };

  const filteredQuestions = assessment.questions.filter((q) => {
    const userAns = attempt.userAnswers[q.id];
    const isSelected = !!userAns?.selectedOptionId;
    const isCorrect = isSelected && userAns.selectedOptionId === q.correctOptionId;

    if (filterMode === 'correct') return isCorrect;
    if (filterMode === 'incorrect') return !isCorrect;
    if (filterMode === 'bookmarked') return !!bookmarkedMap[q.id];
    return true;
  });

  return (
    <div className="space-y-10">
      
      {/* Top Banner & Score Cards */}
      <div className="glass-panel rounded-3xl p-6 sm:p-10 border border-card-border space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-emerald-500/10 via-primary-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Assessment Completed
              </span>
              {attempt.isFirstAttempt !== false ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Official 1st Attempt (Counts for Leaderboard)</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Practice Retake (Does not affect Leaderboard)</span>
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground mt-2">{assessment.title}</h1>
            <p suppressHydrationWarning className="text-xs text-muted-foreground mt-1">
              Completed on {new Date(attempt.timestamp).toLocaleDateString()} at {new Date(attempt.timestamp).toLocaleTimeString()}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/quiz/${assessment.quizId}`)}
              className="px-4 py-2.5 rounded-xl glass-card text-xs font-semibold text-foreground hover:text-foreground border border-slate-700 flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake Test</span>
            </button>

            <button
              onClick={() => router.push('/')}
              className="px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold flex items-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>More Papers</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          
          <div className="p-4 sm:p-5 rounded-2xl bg-card/60 border border-card-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-600/20 text-primary-600 dark:text-primary-400 border border-primary-500/30 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Score Achieved</p>
              <p className="text-2xl font-black text-foreground">
                {attempt.score} <span className="text-sm font-normal text-slate-500">/ {attempt.maxScore}</span>
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-card/60 border border-card-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Accuracy Rate</p>
              <p className="text-2xl font-black text-foreground">{attempt.accuracy}%</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-card/60 border border-card-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Correct / Wrong</p>
              <p className="text-2xl font-black text-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">{attempt.correctCount}</span>
                <span className="text-slate-500 text-sm font-normal"> / </span>
                <span className="text-rose-600 dark:text-rose-400">{attempt.incorrectCount}</span>
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-card/60 border border-card-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-600/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Time Spent</p>
              <p className="text-xl font-black text-foreground">{formatTimeSpent(attempt.timeSpentSeconds)}</p>
            </div>
          </div>

        </div>

      </div>

      {/* Solutions & Review Header */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpenCheck className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-bold text-foreground">Detailed Solutions & Analysis</h2>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card/80 border border-card-border text-xs font-semibold">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'all' ? 'bg-primary-600 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({assessment.questions.length})
            </button>

            <button
              onClick={() => setFilterMode('correct')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'correct' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Correct ({attempt.correctCount})
            </button>

            <button
              onClick={() => setFilterMode('incorrect')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'incorrect' ? 'bg-rose-600 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Incorrect / Skipped ({attempt.incorrectCount + attempt.unansweredCount})
            </button>

            <button
              onClick={() => setFilterMode('bookmarked')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'bookmarked' ? 'bg-primary-600 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Bookmarked ({Object.values(bookmarkedMap).filter(Boolean).length})
            </button>
          </div>
        </div>

        {/* Filtered Questions List */}
        <div className="space-y-6">
          {filteredQuestions.length === 0 ? (
            <div className="p-8 text-center glass-panel rounded-2xl text-muted-foreground text-sm">
              No questions match the selected filter.
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const userAns = attempt.userAnswers[q.id];
              const selectedOptId = userAns?.selectedOptionId || null;

              return (
                <QuestionRenderer
                  quizId={quizId}
                  key={q.id}
                  question={q}
                  currentNumber={q.questionNumber}
                  totalQuestions={assessment.questions.length}
                  selectedOptionId={selectedOptId}
                  onSelectOption={() => {}}
                  isMarkedForReview={false}
                  isBookmarked={!!bookmarkedMap[q.id]}
                  onToggleBookmark={() => handleToggleBookmark(q)}
                  showSolutionImmediately={true}
                />
              );
            })
          )}
        </div>

      </div>

    </div>
  );
}
