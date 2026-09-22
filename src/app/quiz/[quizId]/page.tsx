'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { AssessmentDetail, QuizUserAnswer, QuizAttemptResult } from '@/lib/types';
import { QuestionRenderer } from '@/components/QuestionRenderer';
import { QuizPalette } from '@/components/QuizPalette';
import { saveQuizAttempt, isQuestionBookmarked, toggleBookmark, cleanQuizId, getQuizHistory, isQuizMatch } from '@/lib/storage';
import { useAuth } from '@/lib/authContext';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import { SignInRequired } from '@/components/SignInRequired';
import { 
  Clock, 
  AlertTriangle, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Send, 
  RotateCcw,
  Keyboard,
  Grid,
  X,
  Trophy,
  Lock
} from 'lucide-react';

export default function QuizPlayerPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId: rawQuizId } = use(params);
  const quizId = cleanQuizId(rawQuizId);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFirstAttempt, setIsFirstAttempt] = useState<boolean>(true);
  const [isAttemptConfirmed, setIsAttemptConfirmed] = useState<boolean>(false);
  const isStarted = !isFirstAttempt || isAttemptConfirmed;

  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, QuizUserAnswer>>({});
  const [timeLeft, setTimeLeft] = useState<number>(600);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showExitWarningModal, setShowExitWarningModal] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});

  const allowNavigationRef = useRef(false);

  // Synchronous/Beacon auto-submit when leaving page or refreshing
  const submitBeacon = () => {
    if (!assessment || submittingRef.current) return;
    submittingRef.current = true;
    allowNavigationRef.current = true;

    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    let score = 0;

    const answers = userAnswersRef.current;
    assessment.questions.forEach((q) => {
      const userAns = answers[q.id];
      if (userAns?.selectedOptionId) {
        if (userAns.selectedOptionId === q.correctOptionId) {
          correctCount++;
          score += q.score;
        } else {
          incorrectCount++;
        }
      } else {
        unansweredCount++;
      }
    });

    const totalQuestions = assessment.questions.length;
    const answeredCount = correctCount + incorrectCount;
    const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
    const timeSpent = assessment.timeLimitSeconds - timeLeft;

    const result: QuizAttemptResult = {
      quizId: assessment.quizId,
      quizTitle: assessment.title,
      timestamp: Date.now(),
      isFirstAttempt,
      totalQuestions,
      answeredCount,
      correctCount,
      incorrectCount,
      unansweredCount,
      score,
      maxScore: assessment.totalScore,
      accuracy,
      timeSpentSeconds: timeSpent > 0 ? timeSpent : 0,
      userAnswers: answers
    };

    saveQuizAttempt(result, user?.email);

    if (navigator.sendBeacon) {
      const blob = new Blob(
        [
          JSON.stringify({
            ...result,
            userEmail: user?.email,
            userName: user?.name,
            userImage: user?.image
          })
        ],
        { type: 'application/json' }
      );
      navigator.sendBeacon('/api/attempts', blob);
    }
  };

  // History API Back Trap & Tab Unload Protection
  useEffect(() => {
    if (!assessment || !user || !isStarted) return;

    // Push dummy history entry so back button/swipe stays on current page
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      if (allowNavigationRef.current) return;
      window.history.pushState(null, '', window.location.href);
      setShowExitWarningModal(true);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowNavigationRef.current || submittingRef.current) return;
      submitBeacon();
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [assessment, user, isStarted]);

  // Modal Escape key shortcut
  useEffect(() => {
    const handleModalEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showExitWarningModal) {
          setShowExitWarningModal(false);
        } else if (showSubmitModal) {
          setShowSubmitModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleModalEsc);
    return () => window.removeEventListener('keydown', handleModalEsc);
  }, [showSubmitModal, showExitWarningModal]);

  const userAnswersRef = useRef(userAnswers);
  useEffect(() => {
    userAnswersRef.current = userAnswers;
  }, [userAnswers]);

  const fetchedQuizIdRef = useRef<string>('');

  useEffect(() => {
    async function loadQuiz() {
      if (fetchedQuizIdRef.current === quizId) return;
      fetchedQuizIdRef.current = quizId;

      try {
        setLoading(true);
        const res = await fetch(`/api/questions/${encodeURIComponent(quizId)}`);
        const json = await res.json();

        if (json.isLocked) {
          setIsLocked(true);
          setError(json.error || 'Premium Pass Required: SET 2 and higher require an active PrepTea Candidate Pass.');
        } else if (json.success && json.data) {
          const detail: AssessmentDetail = json.data;
          setAssessment(detail);
          setTimeLeft(detail.timeLimitSeconds || 600);

          // Initialize answer states
          const initialAns: Record<string, QuizUserAnswer> = {};
          const initialBookmarks: Record<string, boolean> = {};

          detail.questions.forEach((q) => {
            initialAns[q.id] = {
              questionId: q.id,
              selectedOptionId: null,
              isMarkedForReview: false,
              timeSpentSeconds: 0
            };
            initialBookmarks[q.id] = isQuestionBookmarked(q.id, user?.email);
          });

          setUserAnswers(initialAns);
          setBookmarkedMap(initialBookmarks);
        } else {
          setError(json.error || 'Failed to load test paper');
        }
      } catch (err) {
        setError('Network error while loading test');
      } finally {
        setLoading(false);
      }
    }

    loadQuiz();
  }, [quizId, user?.email]);

  // Separate effect to check 1st attempt status when user session or quizId updates
  const checkedAttemptRef = useRef<string>('');
  useEffect(() => {
    async function checkFirstAttempt() {
      const key = `${quizId}-${user?.email || 'anon'}`;
      if (checkedAttemptRef.current === key) return;
      checkedAttemptRef.current = key;

      const localHistory = getQuizHistory(user?.email);
      const hasLocalPrior = localHistory.some((a) => isQuizMatch(a.quizId, quizId));
      if (hasLocalPrior) {
        setIsFirstAttempt(false);
      } else if (user?.email) {
        try {
          const checkRes = await fetch(`/api/attempts?quizId=${encodeURIComponent(quizId)}&userEmail=${encodeURIComponent(user.email)}`);
          const checkJson = await checkRes.json();
          if (checkJson.success && checkJson.attempt) {
            setIsFirstAttempt(false);
          }
        } catch {
          // keep true
        }
      }
    }

    checkFirstAttempt();
  }, [quizId, user?.email]);

  // Continuous timer countdown
  useEffect(() => {
    if (!assessment || !user || !isStarted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!submittingRef.current) {
            handleSubmitQuiz();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [assessment, user, isStarted, timeLeft]);

  // Keyboard Navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (showSubmitModal || showExitWarningModal || !isStarted) return;

      const currentQ = assessment?.questions[currentIndex];

      if (currentQ) {
        if (['1', 'a', 'A'].includes(e.key) && currentQ.options[0]) {
          handleSelectOption(currentQ.options[0].id);
        }
        else if (['2', 'b', 'B'].includes(e.key) && currentQ.options[1]) {
          handleSelectOption(currentQ.options[1].id);
        }
        else if (['3', 'c', 'C'].includes(e.key) && currentQ.options[2]) {
          handleSelectOption(currentQ.options[2].id);
        }
        else if (['4', 'd', 'D'].includes(e.key) && currentQ.options[3]) {
          handleSelectOption(currentQ.options[3].id);
        }
        else if (['5', 'e', 'E'].includes(e.key) && currentQ.options[4]) {
          handleSelectOption(currentQ.options[4].id);
        }
        else if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
          e.preventDefault();
          const currentSelId = userAnswersRef.current[currentQ.id]?.selectedOptionId;
          const currentOptIdx = currentQ.options.findIndex((o) => o.id === currentSelId);
          const nextIdx = currentOptIdx === -1 ? 0 : (currentOptIdx + 1) % currentQ.options.length;
          if (currentQ.options[nextIdx]) {
            handleSelectOption(currentQ.options[nextIdx].id);
          }
        }
        else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          const currentSelId = userAnswersRef.current[currentQ.id]?.selectedOptionId;
          const currentOptIdx = currentQ.options.findIndex((o) => o.id === currentSelId);
          const prevIdx = currentOptIdx === -1 ? currentQ.options.length - 1 : (currentOptIdx - 1 + currentQ.options.length) % currentQ.options.length;
          if (currentQ.options[prevIdx]) {
            handleSelectOption(currentQ.options[prevIdx].id);
          }
        }
      }

      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (assessment && currentIndex < assessment.questions.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else if (assessment && currentIndex === assessment.questions.length - 1) {
          setShowSubmitModal(true);
        }
      }
      else if (e.key === 'ArrowLeft') {
        if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
      }
      else if (['m', 'M'].includes(e.key)) handleToggleMarkForReview();
      else if (['s', 'S'].includes(e.key)) handleToggleBookmarkCurrent();
      else if (['x', 'X'].includes(e.key)) handleClearSelection();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assessment, currentIndex, showSubmitModal, showExitWarningModal, isStarted]);

  if (loading || authLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Preparing test environment...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <SignInRequired
        title="Sign In to Start Exam"
        subtitle="Authentication is required to start the test paper, record your official score, and track your performance."
        testTitle={assessment?.title}
      />
    );
  }

  if (isLocked) {
    const titleText = decodeURIComponent(rawQuizId || 'Practice Paper');

    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md glass-panel rounded-3xl p-6 sm:p-8 border border-card-border shadow-2xl text-center space-y-5 bg-card/90 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 uppercase tracking-wider">
              Premium Practice Set
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight pt-1">
              {titleText} is Locked
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This practice paper requires an active PrepTea Candidate Pass. Redeem a promo pass code in your profile or contact your administrator.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
            <button
              onClick={() => router.push('/')}
              className="w-full sm:w-1/2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-foreground text-xs font-bold transition-all text-center border border-slate-700"
            >
              Back to Tests
            </button>

            <button
              onClick={() => router.push('/profile')}
              className="w-full sm:w-1/2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 border border-primary-500/30"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Redeem Pass</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="p-4 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{error || 'Test not found'}</h2>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold"
        >
          Return to Test Hub
        </button>
      </div>
    );
  }

  if (isFirstAttempt && !isAttemptConfirmed) {
    return (
      <div className="max-w-2xl mx-auto my-8 sm:my-16 glass-panel rounded-3xl p-6 sm:p-10 border border-card-border shadow-2xl space-y-6 sm:space-y-8 text-center relative overflow-hidden animate-fade-in">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-lg animate-pulse">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight mt-2">
            First Attempt & Leaderboard Score
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium uppercase tracking-wider text-primary-600 dark:text-primary-400">
            {assessment.title}
          </p>
        </div>

        <div className="space-y-4 text-foreground/80 text-sm sm:text-base leading-relaxed text-left bg-background/40 p-4 sm:p-6 rounded-2xl border border-slate-900">
          <p>
            ⚠️ <strong>This is your 1st attempt at this test paper.</strong>
          </p>
          <p>
            Only your <strong>very first attempt</strong> is officially recorded and submitted to the leaderboard. Retakes or subsequent attempts will run in <em>Practice Mode</em> and will not update your leaderboard score or rank.
          </p>
          <p className="text-xs text-muted-foreground border-t border-card-border/20 pt-3">
            <strong>Tip:</strong> If you are not ready yet, we recommend practicing with other papers first (e.g. Set 1 papers) before starting this official attempt.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => setIsAttemptConfirmed(true)}
            className="flex-1 py-3 px-6 rounded-xl bg-primary-600 hover:bg-primary-500 text-sm font-bold text-white shadow-lg shadow-primary-600/20 hover:shadow-primary-600/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trophy className="w-4 h-4" />
            <span>Start Official Attempt</span>
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex-1 py-3 px-6 rounded-xl bg-card hover:bg-slate-800 border border-card-border text-sm font-bold text-foreground/80 hover:text-foreground hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel & Go Back</span>
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = assessment.questions[currentIndex];
  const currentAnswer = userAnswers[currentQuestion.id] || {
    questionId: currentQuestion.id,
    selectedOptionId: null,
    isMarkedForReview: false,
    timeSpentSeconds: 0
  };

  const handleSelectOption = (optionId: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        selectedOptionId: prev[currentQuestion.id]?.selectedOptionId === optionId ? null : optionId
      }
    }));
  };

  const handleClearSelection = () => {
    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        selectedOptionId: null
      }
    }));
  };

  const handleToggleMarkForReview = () => {
    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        isMarkedForReview: !prev[currentQuestion.id]?.isMarkedForReview
      }
    }));
  };

  const handleToggleBookmarkCurrent = () => {
    if (!assessment) return;
    const isNowBookmarked = toggleBookmark(assessment.quizId, assessment.title, currentQuestion, user?.email);
    setBookmarkedMap((prev) => ({
      ...prev,
      [currentQuestion.id]: isNowBookmarked
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!assessment || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    let score = 0;

    assessment.questions.forEach((q) => {
      const userAns = userAnswers[q.id];
      if (userAns?.selectedOptionId) {
        if (userAns.selectedOptionId === q.correctOptionId) {
          correctCount++;
          score += q.score;
        } else {
          incorrectCount++;
        }
      } else {
        unansweredCount++;
      }
    });

    const totalQuestions = assessment.questions.length;
    const answeredCount = correctCount + incorrectCount;
    const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
    const timeSpentSeconds = assessment.timeLimitSeconds - timeLeft;

    const result: QuizAttemptResult = {
      quizId: assessment.quizId,
      quizTitle: assessment.title,
      timestamp: Date.now(),
      isFirstAttempt,
      totalQuestions,
      answeredCount,
      correctCount,
      incorrectCount,
      unansweredCount,
      score,
      maxScore: assessment.totalScore,
      accuracy,
      timeSpentSeconds,
      userAnswers
    };

    // Sync attempt to MongoDB backend & get authoritative server-evaluated score
    try {
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...result,
          userEmail: user?.email,
          userName: user?.name,
          userImage: user?.image
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        result.score = json.data.score ?? result.score;
        result.maxScore = json.data.maxScore ?? result.maxScore;
        result.accuracy = json.data.accuracy ?? result.accuracy;
        result.correctCount = json.data.correctCount ?? result.correctCount;
        result.incorrectCount = json.data.incorrectCount ?? result.incorrectCount;
        result.unansweredCount = json.data.unansweredCount ?? result.unansweredCount;
      }
    } catch (err) {
      console.error('Failed to post attempt to backend:', err);
    }

    // Save final verified attempt to localStorage for instant local rendering
    saveQuizAttempt(result, user?.email);

    router.replace(`/quiz/${assessment.quizId}/results?t=${result.timestamp}`);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const questionIds = assessment.questions.map((q) => q.id);
  const answeredTotal = Object.values(userAnswers).filter((a) => a.selectedOptionId !== null).length;

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-28">
      
      {/* Top Header Control Bar */}
      <div className="glass-panel rounded-xl sm:rounded-2xl p-2.5 sm:p-5 border border-card-border flex items-center justify-between gap-2 sticky top-2 sm:top-4 z-30 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={() => setShowExitWarningModal(true)}
            className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-card/90 hover:bg-slate-800 text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1 transition-all shrink-0"
            title="Exit test"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Exit</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs sm:text-lg font-bold text-foreground truncate">{assessment.title}</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              Q {currentIndex + 1} of {assessment.questions.length} • {answeredTotal} Done
            </p>
          </div>
        </div>

        {/* Timer & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-mono text-[11px] sm:text-sm font-bold border transition-colors ${
            timeLeft < 120
              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40 animate-pulse'
              : 'bg-card text-primary-600 dark:text-primary-300 border-primary-500/30'
          }`}>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary-600 dark:text-primary-400" />
            <span>{formatTime(timeLeft)}</span>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Submit Test</span>
            <span className="sm:hidden">Submit</span>
          </button>
        </div>
      </div>

      {/* Attempt Status Banner */}
      {isFirstAttempt ? (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>1st Official Attempt:</strong> Your score on this test will be officially recorded on the Leaderboard and User Profile.
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30 shrink-0">
            Leaderboard Score
          </span>
        </div>
      ) : (
        <div className="px-4 py-2.5 rounded-xl bg-amber-950/50 border border-amber-500/30 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Practice Mode:</strong> You already completed your 1st attempt. Retaking this paper won&apos;t alter your official Leaderboard rank.
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30 shrink-0">
            Practice Retake
          </span>
        </div>
      )}

      {/* Main Grid: Left Question, Right Palette */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Question Area (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <QuestionRenderer
            quizId={quizId}
            question={currentQuestion}
            currentNumber={currentIndex + 1}
            totalQuestions={assessment.questions.length}
            selectedOptionId={currentAnswer.selectedOptionId}
            onSelectOption={handleSelectOption}
            isMarkedForReview={currentAnswer.isMarkedForReview}
            onToggleMarkForReview={handleToggleMarkForReview}
            isBookmarked={!!bookmarkedMap[currentQuestion.id]}
            onToggleBookmark={handleToggleBookmarkCurrent}
          />

        </div>

        {/* Question Palette Sidebar (Desktop) */}
        <div className="hidden lg:block lg:col-span-1">
          <QuizPalette
            totalQuestions={assessment.questions.length}
            currentIndex={currentIndex}
            onSelectIndex={(idx) => setCurrentIndex(idx)}
            userAnswers={userAnswers}
            questionIds={questionIds}
          />
        </div>

      </div>

      {/* Fixed Bottom Action & Navigation Bar (Responsive Desktop & Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-card-border/80 py-2.5 px-4 sm:px-8 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          
          {/* Previous Button */}
          <button
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-card border border-card-border hover:bg-slate-800 text-xs font-semibold text-foreground/80 hover:text-foreground disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 transition-all shrink-0"
            title="Previous Question (Hotkey: Left Arrow)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {/* Center Actions / Shortcuts */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Grid Trigger */}
            <button
              onClick={() => setShowMobilePalette(true)}
              className="lg:hidden py-2 px-3 rounded-xl bg-card border border-card-border text-foreground text-xs font-bold flex items-center gap-1.5"
            >
              <Grid className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 shrink-0" />
              <span>Q {currentIndex + 1} / {assessment.questions.length}</span>
            </button>

            {/* Clear Selection */}
            {currentAnswer.selectedOptionId && (
              <button
                onClick={handleClearSelection}
                className="px-3 py-2 sm:py-2.5 rounded-xl bg-card border border-card-border hover:border-slate-700 text-amber-600 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-all shrink-0"
                title="Unselect chosen option (Hotkey: X)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            {/* Desktop Hotkeys Hint */}
            <div className="hidden lg:flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground/80">Hotkeys:</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-foreground/80 border border-slate-700">1-4</kbd>/<kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-foreground/80 border border-slate-700">A-D</kbd> Select</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-foreground/80 border border-slate-700">↑/↓</kbd> Options</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-foreground/80 border border-slate-700">←/→</kbd> Nav</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-foreground/80 border border-slate-700">M</kbd> Mark</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-foreground/80 border border-slate-700">X</kbd> Clear</span>
            </div>
          </div>

          {/* Next / Submit Button */}
          <button
            onClick={() => {
              if (currentIndex < assessment.questions.length - 1) {
                setCurrentIndex((prev) => prev + 1);
              } else {
                setShowSubmitModal(true);
              }
            }}
            className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs transition-all shadow-md shadow-primary-600/20 flex items-center gap-2 shrink-0"
          >
            <span>{currentIndex < assessment.questions.length - 1 ? 'Next Question' : 'Review & Submit'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

        </div>
      </div>

      {/* Mobile Question Palette Modal Drawer */}
      {showMobilePalette && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm lg:hidden">
          <div className="glass-panel rounded-2xl w-full max-w-md p-4 sm:p-5 border border-slate-700 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <h3 className="text-sm font-bold text-foreground">Question Navigator</h3>
              <button
                onClick={() => setShowMobilePalette(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <QuizPalette
              totalQuestions={assessment.questions.length}
              currentIndex={currentIndex}
              onSelectIndex={(idx) => {
                setCurrentIndex(idx);
                setShowMobilePalette(false);
              }}
              userAnswers={userAnswers}
              questionIds={questionIds}
            />
          </div>
        </div>
      )}

      {/* Confirmation Submit Modal */}
      {showSubmitModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) {
              setShowSubmitModal(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="glass-panel rounded-2xl max-w-md w-full p-6 border border-slate-700 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
              <h2 className="text-xl font-bold text-foreground">Submit Assessment?</h2>
            </div>

            <div className="space-y-3 text-sm text-foreground/80 bg-card/60 p-4 rounded-xl border border-card-border">
              <div className="flex justify-between">
                <span>Total Questions:</span>
                <strong className="text-foreground">{assessment.questions.length}</strong>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                <span>Answered:</span>
                <strong>{answeredTotal}</strong>
              </div>
              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span>Unanswered:</span>
                <strong>{assessment.questions.length - answeredTotal}</strong>
              </div>
              <div className="flex justify-between text-primary-600 dark:text-primary-400">
                <span>Time Remaining:</span>
                <strong>{formatTime(timeLeft)}</strong>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
              isFirstAttempt
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
            }`}>
              {isFirstAttempt ? (
                <div className="flex items-start gap-2">
                  <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>Notice:</strong> This is your <strong>1st Official Attempt</strong>. Your final score will be recorded on your profile and count toward the global Leaderboard!
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>Notice:</strong> This is a <strong>Practice Retake</strong>. Your score will be saved in your personal history, but your official Leaderboard score will remain unchanged.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl glass-card text-xs font-semibold text-foreground/80 hover:text-foreground disabled:opacity-50"
              >
                Continue Test
              </button>

              <button
                onClick={handleSubmitQuiz}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Confirm Submission</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Exam Confirmation Warning Modal */}
      {showExitWarningModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowExitWarningModal(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
        >
          <div className="glass-panel rounded-3xl max-w-md w-full p-6 border border-rose-500/30 space-y-6 shadow-2xl relative bg-background/90">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Exit Exam Confirmation</h2>
                <p className="text-xs text-rose-600 dark:text-rose-300 font-medium">Exam session currently in progress</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed bg-card/80 p-4 rounded-2xl border border-card-border">
              Are you sure you want to exit? Your answers so far will be automatically submitted and saved.
            </p>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => setShowExitWarningModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-foreground text-xs font-semibold transition-all"
              >
                Resume Exam
              </button>
              <button
                onClick={() => {
                  setShowExitWarningModal(false);
                  handleSubmitQuiz();
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all"
              >
                Submit & Exit
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
