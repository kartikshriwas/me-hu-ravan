'use client';

import { useState, useEffect, useRef } from 'react';
import { Trophy, Medal, Award, Flame, Target, User, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import { UserAvatar } from '@/components/UserAvatar';
import { LeaderboardSkeleton } from '@/components/skeletons/LeaderboardSkeleton';
import { clientCache } from '@/lib/clientCache';

interface LeaderboardUser {
  rank: number;
  id?: string;
  name: string;
  email: string;
  image?: string;
  totalScore: number;
  testsCompleted: number;
  averageAccuracy: number;
}

export default function LeaderboardPage() {
  const { user: currentUser } = useAuth();
  const cachedData = typeof window !== 'undefined' ? clientCache.get<{ success: boolean; data: LeaderboardUser[] }>('/api/leaderboard') : null;
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>(cachedData?.data || []);
  const [loading, setLoading] = useState(!cachedData?.data?.length);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const json = await clientCache.fetchWithCache<{ success: boolean; data: LeaderboardUser[] }>('/api/leaderboard', undefined, 30000);
        if (json?.success && Array.isArray(json.data)) {
          setLeaderboard(json.data);
        }
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, []);

  const topThree = leaderboard.slice(0, 3);

  if (loading) {
    return <LeaderboardSkeleton />;
  }

  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-10" role="main">
      
      {/* Header Banner */}
      <header className="glass-panel rounded-3xl p-6 sm:p-10 border border-primary-500/30 relative overflow-hidden space-y-4">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs font-semibold">
              <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>GLOBAL CANDIDATE RANKINGS</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-foreground mt-2">Leaderboard</h1>
            <p className="text-sm text-foreground/80 mt-1">
              Top candidates ranked by total assessment points, accuracy, and completed test papers.
            </p>
          </div>

          {!currentUser && (
            <GoogleLoginButton label="Join Leaderboard" size="medium" />
          )}
        </div>
      </header>

      {leaderboard.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-3xl space-y-4">
          <Trophy className="w-10 h-10 text-amber-600 dark:text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold text-foreground">No Rankings Recorded Yet</h2>
          <p className="text-xs text-muted-foreground">
            Be the first candidate to complete a test and claim the #1 spot on the leaderboard!
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          
          {/* Top 3 Podium Cards */}
          {topThree.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              
              {/* #2 Silver (First on mobile layout or left) */}
              {topThree[1] && (
                <div className="glass-card rounded-3xl p-6 border border-slate-700/80 flex flex-col items-center text-center space-y-4 relative order-2 md:order-1 transform md:translate-y-4">
                  <div className="absolute -top-4 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-foreground/80 text-xs font-bold flex items-center gap-1 shadow-md">
                    <Medal className="w-3.5 h-3.5 text-foreground/80" /> #2 Silver
                  </div>

                  <div className="mt-2">
                    <UserAvatar name={topThree[1].name} image={topThree[1].image} size="lg" />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-foreground">{topThree[1].name}</h3>
                    <p className="text-xs text-muted-foreground">{topThree[1].testsCompleted} Tests Completed</p>
                  </div>

                  <div className="w-full pt-3 border-t border-card-border/80 flex justify-between text-xs text-foreground/80 font-semibold">
                    <span>Points: <strong className="text-primary-600 dark:text-primary-400">{topThree[1].totalScore} pts</strong></span>
                    <span>Accuracy: <strong className="text-emerald-600 dark:text-emerald-400">{topThree[1].averageAccuracy}%</strong></span>
                  </div>
                </div>
              )}

              {/* #1 Gold (Center, Enlarged) */}
              {topThree[0] && (
                <div className="glass-card rounded-3xl p-8 border-2 border-amber-500/50 flex flex-col items-center text-center space-y-4 relative order-1 md:order-2 shadow-2xl shadow-amber-500/10 bg-card/90">
                  <div className="absolute -top-5 px-4 py-1.5 rounded-full bg-amber-500 text-black text-xs font-black flex items-center gap-1.5 shadow-lg">
                    <Trophy className="w-4 h-4" /> #1 CHAMPION
                  </div>

                  <div className="mt-2">
                    <UserAvatar name={topThree[0].name} image={topThree[0].image} size="xl" />
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-foreground">{topThree[0].name}</h3>
                    <p className="text-xs text-amber-600 dark:text-amber-300/80 font-semibold">{topThree[0].testsCompleted} Tests Completed</p>
                  </div>

                  <div className="w-full pt-4 border-t border-card-border/80 flex justify-between text-xs text-foreground font-bold">
                    <span>Total: <strong className="text-amber-600 dark:text-amber-400 text-sm">{topThree[0].totalScore} pts</strong></span>
                    <span>Accuracy: <strong className="text-emerald-600 dark:text-emerald-400 text-sm">{topThree[0].averageAccuracy}%</strong></span>
                  </div>
                </div>
              )}

              {/* #3 Bronze (Right) */}
              {topThree[2] && (
                <div className="glass-card rounded-3xl p-6 border border-slate-700/80 flex flex-col items-center text-center space-y-4 relative order-3 md:order-3 transform md:translate-y-4">
                  <div className="absolute -top-4 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-amber-600 text-xs font-bold flex items-center gap-1 shadow-md">
                    <Award className="w-3.5 h-3.5 text-amber-600" /> #3 Bronze
                  </div>

                  <div className="mt-2">
                    <UserAvatar name={topThree[2].name} image={topThree[2].image} size="lg" />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-foreground">{topThree[2].name}</h3>
                    <p className="text-xs text-muted-foreground">{topThree[2].testsCompleted} Tests Completed</p>
                  </div>

                  <div className="w-full pt-3 border-t border-card-border/80 flex justify-between text-xs text-foreground/80 font-semibold">
                    <span>Points: <strong className="text-primary-600 dark:text-primary-400">{topThree[2].totalScore} pts</strong></span>
                    <span>Accuracy: <strong className="text-emerald-600 dark:text-emerald-400">{topThree[2].averageAccuracy}%</strong></span>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Full Leaderboard Table (Ranks 4+) */}
          {leaderboard.length > 3 && (
            <div className="glass-panel rounded-2xl border border-card-border overflow-hidden shadow-2xl">
              <div className="p-4 sm:p-5 border-b border-card-border flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Candidate Rankings</span>
                </h2>
              <span className="text-xs text-muted-foreground">{leaderboard.length} Candidates</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-card/80 text-muted-foreground uppercase text-[11px] font-semibold border-b border-card-border">
                    <tr>
                      <th className="py-3 px-4 sm:px-6">Rank</th>
                      <th className="py-3 px-4 sm:px-6">Candidate</th>
                      <th className="py-3 px-4 sm:px-6 text-center">Tests Taken</th>
                      <th className="py-3 px-4 sm:px-6 text-center">Avg Accuracy</th>
                      <th className="py-3 px-4 sm:px-6 text-right">Total Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {leaderboard.slice(3).map((item) => {
                      const isMe = currentUser?.email === item.email;
                      return (
                        <tr
                          key={item.id || `rank-${item.rank}-${item.email}`}
                          className={`transition-colors ${
                            isMe
                              ? 'bg-primary-600/10 hover:bg-primary-600/20 font-semibold'
                              : 'hover:bg-card/40 text-foreground'
                          }`}
                        >
                          <td className="py-3.5 px-4 sm:px-6 font-bold">
                            <span>#{item.rank}</span>
                          </td>

                        <td className="py-3.5 px-4 sm:px-6 flex items-center gap-3">
                          <UserAvatar name={item.name} image={item.image} size="sm" />
                          <div>
                            <p className="font-bold text-foreground">{item.name} {isMe && <span className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold">(You)</span>}</p>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 sm:px-6 text-center font-semibold text-foreground/80">
                          {item.testsCompleted}
                        </td>

                        <td className="py-3.5 px-4 sm:px-6 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 font-bold">
                            {item.averageAccuracy}%
                          </span>
                        </td>

                        <td className="py-3.5 px-4 sm:px-6 text-right font-black text-primary-600 dark:text-primary-400 text-sm sm:text-base">
                          {item.totalScore} pts
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        </div>
      )}

    </main>
  );
}
