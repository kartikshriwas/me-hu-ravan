'use client';

import { useState, useEffect, useRef } from 'react';
import { Trophy, Medal, Award, Flame, Target, User, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import { UserAvatar } from '@/components/UserAvatar';

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
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function loadLeaderboard() {
      try {
        setLoading(true);
        const res = await fetch('/api/leaderboard');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
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

  return (
    <div className="space-y-10">
      
      {/* Header Banner */}
      <div className="glass-panel rounded-3xl p-6 sm:p-10 border border-indigo-500/30 relative overflow-hidden space-y-4">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-500/15 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>GLOBAL CANDIDATE RANKINGS</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mt-2">Leaderboard</h1>
            <p className="text-sm text-slate-300 mt-1">
              Top candidates ranked by total assessment points, accuracy, and completed test papers.
            </p>
          </div>

          {!currentUser && (
            <GoogleLoginButton label="Join Leaderboard" size="medium" />
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="glass-panel rounded-3xl p-8 h-64 animate-pulse bg-slate-900/40" />
            ))}
          </div>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-3xl space-y-4">
          <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">No Rankings Recorded Yet</h2>
          <p className="text-xs text-slate-400">
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
                  <div className="absolute -top-4 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 shadow-md">
                    <Medal className="w-3.5 h-3.5 text-slate-300" /> #2 Silver
                  </div>

                  <div className="mt-2">
                    <UserAvatar name={topThree[1].name} image={topThree[1].image} size="lg" />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white">{topThree[1].name}</h3>
                    <p className="text-xs text-slate-400">{topThree[1].testsCompleted} Tests Completed</p>
                  </div>

                  <div className="w-full pt-3 border-t border-slate-800/80 flex justify-between text-xs text-slate-300 font-semibold">
                    <span>Points: <strong className="text-indigo-400">{topThree[1].totalScore} pts</strong></span>
                    <span>Accuracy: <strong className="text-emerald-400">{topThree[1].averageAccuracy}%</strong></span>
                  </div>
                </div>
              )}

              {/* #1 Gold (Center, Enlarged) */}
              {topThree[0] && (
                <div className="glass-card rounded-3xl p-8 border-2 border-amber-500/50 flex flex-col items-center text-center space-y-4 relative order-1 md:order-2 shadow-2xl shadow-amber-500/10 bg-slate-900/90">
                  <div className="absolute -top-5 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-black flex items-center gap-1.5 shadow-lg">
                    <Trophy className="w-4 h-4" /> #1 CHAMPION
                  </div>

                  <div className="mt-2">
                    <UserAvatar name={topThree[0].name} image={topThree[0].image} size="xl" />
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-white">{topThree[0].name}</h3>
                    <p className="text-xs text-amber-300/80 font-semibold">{topThree[0].testsCompleted} Tests Completed</p>
                  </div>

                  <div className="w-full pt-4 border-t border-slate-800/80 flex justify-between text-xs text-slate-200 font-bold">
                    <span>Total: <strong className="text-amber-400 text-sm">{topThree[0].totalScore} pts</strong></span>
                    <span>Accuracy: <strong className="text-emerald-400 text-sm">{topThree[0].averageAccuracy}%</strong></span>
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
                    <h3 className="text-lg font-bold text-white">{topThree[2].name}</h3>
                    <p className="text-xs text-slate-400">{topThree[2].testsCompleted} Tests Completed</p>
                  </div>

                  <div className="w-full pt-3 border-t border-slate-800/80 flex justify-between text-xs text-slate-300 font-semibold">
                    <span>Points: <strong className="text-indigo-400">{topThree[2].totalScore} pts</strong></span>
                    <span>Accuracy: <strong className="text-emerald-400">{topThree[2].averageAccuracy}%</strong></span>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Full Leaderboard Table */}
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Candidate Rankings</span>
              </h2>
              <span className="text-xs text-slate-400">{leaderboard.length} Candidates</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 sm:px-6">Rank</th>
                    <th className="py-3 px-4 sm:px-6">Candidate</th>
                    <th className="py-3 px-4 sm:px-6 text-center">Tests Taken</th>
                    <th className="py-3 px-4 sm:px-6 text-center">Avg Accuracy</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Total Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {leaderboard.map((item) => {
                    const isMe = currentUser?.email === item.email;
                    return (
                      <tr
                        key={item.email}
                        className={`transition-colors ${
                          isMe
                            ? 'bg-indigo-600/10 hover:bg-indigo-600/20 font-semibold'
                            : 'hover:bg-slate-900/40 text-slate-200'
                        }`}
                      >
                        <td className="py-3.5 px-4 sm:px-6 font-bold">
                          {item.rank === 1 ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">🥇 1</span>
                          ) : item.rank === 2 ? (
                            <span className="px-2 py-0.5 rounded-md bg-slate-700/40 text-slate-300 border border-slate-600/40">🥈 2</span>
                          ) : item.rank === 3 ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-800/20 text-amber-500 border border-amber-700/40">🥉 3</span>
                          ) : (
                            <span>#{item.rank}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 sm:px-6 flex items-center gap-3">
                          <UserAvatar name={item.name} image={item.image} size="sm" />
                          <div>
                            <p className="font-bold text-white">{item.name} {isMe && <span className="text-[10px] text-indigo-400 font-semibold">(You)</span>}</p>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 sm:px-6 text-center font-semibold text-slate-300">
                          {item.testsCompleted}
                        </td>

                        <td className="py-3.5 px-4 sm:px-6 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                            {item.averageAccuracy}%
                          </span>
                        </td>

                        <td className="py-3.5 px-4 sm:px-6 text-right font-black text-indigo-400 text-sm sm:text-base">
                          {item.totalScore} pts
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
