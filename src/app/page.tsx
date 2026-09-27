'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AssessmentMeta, QuizAttemptResult } from '@/lib/types';
import { getQuizHistory, isQuizMatch } from '@/lib/storage';
import { useAuth } from '@/lib/authContext';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import { SignInRequired } from '@/components/SignInRequired';
import { PremiumGateModal } from '@/components/PremiumGateModal';
import { EventPromoBanner } from '@/components/EventPromoBanner';
import { 
  FileCheck2, 
  Clock, 
  Brain, 
  ArrowRight, 
  Award, 
  Search, 
  Trophy, 
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Users,
  Target,
  Lock,
  Crown,
  X
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tests, setTests] = useState<AssessmentMeta[]>([]);
  const [history, setHistory] = useState<QuizAttemptResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [recentAttempt, setRecentAttempt] = useState<QuizAttemptResult | null>(null);
  const [selectedTestForLoginModal, setSelectedTestForLoginModal] = useState<AssessmentMeta | null>(null);
  const [selectedTestForPremiumModal, setSelectedTestForPremiumModal] = useState<AssessmentMeta | null>(null);

  // Auto-redirect to target test paper as soon as user logs in via modal popup
  useEffect(() => {
    if (user && selectedTestForLoginModal) {
      const targetQuizId = selectedTestForLoginModal.quizId;
      setSelectedTestForLoginModal(null);
      router.push(`/quiz/${targetQuizId}`);
    }
  }, [user, selectedTestForLoginModal, router]);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function fetchAssessments() {
      try {
        const res = await fetch('/api/questions');
        const json = await res.json();
        if (json.success) {
          setTests(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch practice tests:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAssessments();
  }, []);

  useEffect(() => {
    async function syncUserHistory() {
      if (!user?.email) {
        setHistory([]);
        setRecentAttempt(null);
        return;
      }

      // 1. Initial local history for instantaneous rendering
      const localH = getQuizHistory(user.email);
      setHistory(localH);
      if (localH.length > 0) setRecentAttempt(localH[0]);

      // 2. Fetch MongoDB remote attempts for the active user account
      try {
        const res = await fetch('/api/attempts');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const remoteAttempts: QuizAttemptResult[] = json.data.map((remote: any) => ({
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
            isFirstAttempt: remote.isFirstAttempt,
            userAnswers: remote.userAnswers || {}
          }));

          const mergedMap = new Map<string, QuizAttemptResult>();
          [...localH, ...remoteAttempts].forEach((item) => {
            const key = `${item.quizId}-${item.timestamp}`;
            if (!mergedMap.has(key)) {
              mergedMap.set(key, item);
            }
          });

          const sorted = Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
          setHistory(sorted);
          if (sorted.length > 0) {
            setRecentAttempt(sorted[0]);
          }
        }
      } catch (err) {
        console.error('Failed to sync remote user attempts:', err);
      }
    }

    syncUserHistory();
  }, [user?.email]);

  // Map history attempts by matching quizId flexibly
  const getAttemptForTest = (quizId: string) => {
    const matched = history.filter((item) => isQuizMatch(item.quizId, quizId));
    if (matched.length === 0) return undefined;
    const latest = matched[0];
    const firstAttempt = matched.find((a) => a.isFirstAttempt !== false) || matched[matched.length - 1];
    const bestScore = matched.reduce((max, item) => Math.max(max, item.score), 0);
    return { latest, firstAttempt, bestScore, count: matched.length };
  };

  const filteredTests = tests.filter((t) => {
    const query = searchQuery.toLowerCase().trim();

    const setMatch = t.quizId.match(/\d+/);
    const setNum = setMatch ? setMatch[0] : '';
    const setAlias1 = `set ${setNum}`.toLowerCase();
    const setAlias2 = `set${setNum}`.toLowerCase();

    const matchesSearch = !query ||
                          t.title.toLowerCase().includes(query) ||
                          t.quizId.toLowerCase().includes(query) ||
                          t.description.toLowerCase().includes(query) ||
                          (setNum !== '' && (setAlias1.includes(query) || setAlias2.includes(query) || query === `#set ${setNum}` || query === `#set${setNum}`));
    const matchesDifficulty = selectedDifficulty === 'All' || t.difficulty === selectedDifficulty;
    return matchesSearch && matchesDifficulty;
  }).sort((a, b) => {
    const setMatchA = a.quizId.match(/\d+/);
    const setNumA = setMatchA ? parseInt(setMatchA[0], 10) : 1;
    const isLockedA = setNumA > 1 && !user?.isPremium;

    const setMatchB = b.quizId.match(/\d+/);
    const setNumB = setMatchB ? parseInt(setMatchB[0], 10) : 1;
    const isLockedB = setNumB > 1 && !user?.isPremium;

    if (!isLockedA && isLockedB) return -1;
    if (isLockedA && !isLockedB) return 1;
    return 0;
  });

  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8">
      {/* Active Events / Promos Banner for Non-Premium & Guests */}
      <EventPromoBanner />
      
      {/* Top Search & Difficulty Filters Bar */}
      <section className="glass-panel rounded-2xl p-4 sm:p-5 border border-card-border space-y-3 md:space-y-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 shadow-xl">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search test (e.g. TCS, Digital, Easy, SET 1)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card/90 border border-card-border text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-colors"
          />
        </div>

        {/* Difficulty Pills & Test Counter */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-card/90 border border-card-border text-xs font-semibold shrink-0">
            {['All', 'Easy', 'Medium', 'Hard'].map((diff) => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all ${
                  selectedDifficulty === diff
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>

          <span className="text-xs font-bold text-muted-foreground bg-card px-3 py-2 rounded-xl border border-card-border shrink-0">
            {filteredTests.length} {filteredTests.length === 1 ? 'Test' : 'Tests'}
          </span>
        </div>
      </section>

      {/* Recent Activity Resume Banner (Or Loading Skeleton) */}
      {loading ? (
        <div className="glass-panel rounded-2xl p-5 border border-card-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse bg-card/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 shrink-0" />
            <div className="space-y-2">
              <div className="w-24 h-3.5 rounded bg-slate-800/80" />
              <div className="w-44 h-4 rounded bg-slate-800/80" />
              <div className="w-32 h-3 rounded bg-slate-800/80" />
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="w-28 h-9 rounded-xl bg-slate-800/80" />
            <div className="w-9 h-9 rounded-xl bg-slate-800/80 shrink-0" />
          </div>
        </div>
      ) : recentAttempt ? (
        <section className="glass-panel rounded-2xl p-5 border border-primary-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                Recent Attempt
              </span>
              <h3 className="text-base font-bold text-foreground">
                {recentAttempt.quizTitle}
              </h3>
              <p className="text-xs text-muted-foreground">
                Score: <strong className="text-emerald-600 dark:text-emerald-400">{recentAttempt.score}/{recentAttempt.maxScore}</strong> • Accuracy: <strong className="text-foreground">{recentAttempt.accuracy}%</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              href={`/quiz/${recentAttempt.quizId}/results?t=${recentAttempt.timestamp}`}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-primary-600/20 hover:bg-primary-600 text-primary-600 dark:text-primary-300 hover:text-white text-xs font-bold border border-primary-500/30 hover:border-transparent transition-all text-center"
            >
              View Solutions
            </Link>
            <Link
              href={`/quiz/${recentAttempt.quizId}`}
              className="p-2 rounded-xl bg-card hover:bg-slate-800 text-foreground/80 hover:text-foreground border border-card-border text-xs shrink-0"
              title="Retake Test"
            >
              <RotateCcw className="w-4 h-4" />
            </Link>
          </div>
        </section>
      ) : null}

      {/* Tests Catalog Grid */}
      <section className="space-y-6">
        
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2.5">
              <FileCheck2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 dark:text-primary-400" />
              <span>Available Practice Papers ({filteredTests.length})</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Distinct test papers with attempt status tracking. Select any set to start.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="glass-panel rounded-2xl p-6 h-56 animate-pulse bg-card/40" />
            ))}
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="p-12 text-center glass-panel rounded-3xl space-y-3">
            <Award className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto" />
            <p className="text-sm text-foreground/80 font-medium">No practice tests match your search criteria.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedDifficulty('All'); }}
              className="px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-6">
            {filteredTests.map((test) => {
              const attemptInfo = getAttemptForTest(test.quizId);
              const isAttempted = !!attemptInfo;

              let diffColor = 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40';
              if (test.difficulty === 'Medium') diffColor = 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40';
              if (test.difficulty === 'Hard') diffColor = 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40';

              const setMatch = test.quizId.match(/\d+/);
              const setNum = setMatch ? setMatch[0] : (filteredTests.indexOf(test) + 1);
              const setLabel = `#SET ${setNum}`;

              const isLocked = Number(setNum) > 1 && !user?.isPremium;

              return (
                <div key={test.quizId} className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col justify-between group relative overflow-hidden transition-all duration-300 hover:border-primary-500/40 hover:shadow-xl hover:shadow-primary-950/20">
                  
                  {/* Card Header */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${diffColor}`}>
                          {test.difficulty}
                        </span>
                        <span className="text-[11px] font-bold tracking-wider uppercase text-primary-600 dark:text-primary-400">
                          {setLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isLocked && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Pro</span>
                          </span>
                        )}

                        {isAttempted && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>{attemptInfo.count}x</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary-600 dark:group-hover:text-primary-300 transition-colors line-clamp-1">
                        {test.title}
                      </h3>
                      {test.description && test.description.trim().length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {test.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Body Metrics: Modern Sleek Pills */}
                  <div className="space-y-3 mt-5">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-card/80 rounded-xl px-3 py-2 border border-card-border/80 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                          <FileCheck2 className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                          <span>Questions</span>
                        </span>
                        <strong className="text-foreground font-bold">{test.totalQuestions}</strong>
                      </div>

                      <div className="bg-card/80 rounded-xl px-3 py-2 border border-card-border/80 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                          <span>Duration</span>
                        </span>
                        <strong className="text-foreground font-bold">{Math.round(test.timeLimitSeconds / 60)}m</strong>
                      </div>

                      <div className="bg-card/80 rounded-xl px-3 py-2 border border-card-border/80 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Accuracy</span>
                        </span>
                        <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{test.avgAccuracy ? `${test.avgAccuracy}%` : '0%'}</strong>
                      </div>

                      <div className="bg-card/80 rounded-xl px-3 py-2 border border-card-border/80 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Max Points</span>
                        </span>
                        <strong className="text-amber-600 dark:text-amber-300 font-bold">{test.totalScore || 0}</strong>
                      </div>
                    </div>

                    {attemptInfo && (
                      <div className="bg-primary-950/40 rounded-xl px-3 py-2 border border-primary-500/20 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground text-[11px] font-medium">Your 1st Score</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {attemptInfo.firstAttempt.score} / {test.totalScore} ({attemptInfo.firstAttempt.accuracy}%)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-6 pt-2">
                    {isLocked ? (
                      <button
                        onClick={() => {
                          if (!user) setSelectedTestForLoginModal(test);
                          else setSelectedTestForPremiumModal(test);
                        }}
                        className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Crown className="w-4 h-4" />
                        <span>Unlock Premium Test</span>
                      </button>
                    ) : isAttempted ? (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/quiz/${test.quizId}/results?t=${attemptInfo.latest.timestamp}`}
                          className="flex-1 py-2.5 rounded-xl bg-card hover:bg-slate-800 text-foreground/80 hover:text-foreground text-xs font-bold border border-card-border text-center transition-all"
                        >
                          Solutions
                        </Link>
                        {user ? (
                          <Link
                            href={`/quiz/${test.quizId}`}
                            className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-600/20 transition-all flex items-center justify-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Retake</span>
                          </Link>
                        ) : (
                          <button
                            onClick={() => setSelectedTestForLoginModal(test)}
                            className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-600/20 transition-all flex items-center justify-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Retake</span>
                          </button>
                        )}
                      </div>
                    ) : user ? (
                      <Link
                        href={`/quiz/${test.quizId}`}
                        className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-600/20 transition-all flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                      >
                        <span>Start Test</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <button
                        onClick={() => setSelectedTestForLoginModal(test)}
                        className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-600/20 transition-all flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                      >
                        <span>Start Test</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Login Required Popup Modal */}
      {selectedTestForLoginModal && (
        <SignInRequired
          isModal
          title="Sign In Required"
          subtitle="Please sign in with your Google account to attempt this test paper."
          testTitle={selectedTestForLoginModal.title}
          onClose={() => setSelectedTestForLoginModal(null)}
        />
      )}

      {/* Premium Unlock Popup Modal */}
      {selectedTestForPremiumModal && (
        <PremiumGateModal
          isOpen={!!selectedTestForPremiumModal}
          title={selectedTestForPremiumModal.title}
          onClose={() => setSelectedTestForPremiumModal(null)}
          onSuccess={() => setSelectedTestForPremiumModal(null)}
        />
      )}

    </div>
  );
}
