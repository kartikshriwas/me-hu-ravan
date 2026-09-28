'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getQuizHistory } from '@/lib/storage';
import { QuizAttemptResult } from '@/lib/types';
import { useAuth } from '@/lib/authContext';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import { SignInRequired } from '@/components/SignInRequired';
import { History, Trophy, Target, Clock, RotateCcw, Lock } from 'lucide-react';
import { HistorySkeleton } from '@/components/skeletons/HistorySkeleton';
import { clientCache } from '@/lib/clientCache';

export default function HistoryPage() {
  const { user } = useAuth();
  const cachedAttempts = typeof window !== 'undefined' ? clientCache.get<any>('/api/attempts') : null;
  const [history, setHistory] = useState<QuizAttemptResult[]>([]);
  const [loading, setLoading] = useState(!cachedAttempts);

  const fetchedEmailRef = useRef<string>('');

  useEffect(() => {
    async function loadHistory() {
      const email = user?.email;
      if (!email) {
        setHistory(getQuizHistory(null));
        setLoading(false);
        return;
      }

      let localHistory = getQuizHistory(email);

      try {
        const json = await clientCache.fetchWithCache<any>('/api/attempts', undefined, 60000);
        if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
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
              userAnswers: remote.userAnswers || {}
            }));

            const mergedMap = new Map<string, QuizAttemptResult>();
            [...localHistory, ...remoteAttempts].forEach((item) => {
              const key = `${item.quizId}-${item.timestamp}`;
              if (!mergedMap.has(key)) {
                mergedMap.set(key, item);
              }
            });
            localHistory = Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
          }
        } catch (err) {
          console.error('Failed to load remote attempts:', err);
        }

        setHistory(localHistory);
        setLoading(false);
      }

      loadHistory();
    }, [user?.email]);

  const formatTimeSpent = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return <HistorySkeleton />;
  }

  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8" role="main">
      
      {/* Header */}
      <header className="glass-panel rounded-3xl p-6 sm:p-8 border border-card-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold text-xs mb-2">
            <History className="w-4 h-4" />
            <span>PERFORMANCE LOG</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">Test History</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Track your past practice test scores, accuracy, and detailed results.
          </p>
        </div>

        <div className="text-xs font-semibold text-muted-foreground bg-card px-4 py-2.5 rounded-xl border border-card-border">
          {`${history.length} Attempts`}
        </div>
      </header>

      {!user ? (
        <SignInRequired
          title="Sign In to View History"
          subtitle="Please sign in with your Google account to access your personal assessment history and test records."
        />
      ) : history.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-3xl space-y-4">
          <Trophy className="w-10 h-10 text-primary-600 dark:text-primary-400 mx-auto" />
          <h2 className="text-lg font-bold text-foreground">No Test History Yet</h2>
          <p className="text-xs text-muted-foreground">
            You haven&apos;t completed any assessment tests yet. Choose a paper from the homepage to get started!
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-colors"
          >
            Explore Tests
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {history.map((item, idx) => (
            <article
              key={`${item.quizId}-${item.timestamp}-${idx}`}
              className="glass-card rounded-2xl p-5 border border-card-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-primary-500/20 text-primary-600 dark:text-primary-300 border border-primary-500/30 text-[11px] font-bold uppercase">
                    SET #{item.quizId.toUpperCase().replace('Q', '')}
                  </span>
                  {item.isFirstAttempt !== false ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Official (1st Attempt)</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <RotateCcw className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>Practice Retake</span>
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500 font-medium">
                    {new Date(item.timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-foreground group-hover:text-primary-600 dark:group-hover:text-primary-300 transition-colors">
                  {item.quizTitle}
                </h3>

                <div className="flex flex-wrap items-center gap-4 text-xs text-foreground/80 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Score: <strong className="text-foreground">{item.score}/{item.maxScore}</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Accuracy: <strong className="text-emerald-600 dark:text-emerald-400">{item.accuracy}%</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                    <span>Time: <strong className="text-foreground">{formatTimeSpent(item.timeSpentSeconds)}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Link
                  href={`/quiz/${item.quizId}/results?t=${item.timestamp}`}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-primary-600/20 hover:bg-primary-600 text-primary-600 dark:text-primary-300 hover:text-white text-xs font-bold border border-primary-500/30 hover:border-transparent transition-all text-center"
                >
                  View Solutions
                </Link>

                <Link
                  href={`/quiz/${item.quizId}`}
                  className="p-2.5 rounded-xl bg-card hover:bg-slate-800 text-foreground/80 hover:text-foreground border border-card-border text-xs shrink-0"
                  title="Retake Test"
                >
                  <RotateCcw className="w-4 h-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

    </main>
  );
}
