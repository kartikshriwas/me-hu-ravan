'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { UserAvatar } from '@/components/UserAvatar';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import {
  Trophy,
  Crown,
  Key,
  ShieldCheck,
  Calendar,
  Sparkles,
  Flame,
  FileCheck2,
  Clock,
  ArrowRight,
  CheckCircle2,
  Lock,
  RotateCcw,
  BookOpen
} from 'lucide-react';

interface ProfileData {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
    role: 'superadmin' | 'admin' | 'user';
    adminPermissions: string[];
    isPremium: boolean;
    hasCourseAccess?: boolean;
    premiumExpiresAt?: string | null;
    premiumPlan?: string;
    totalScore: number;
    testsCompleted: number;
    averageAccuracy: number;
    createdAt: string;
    rank: number;
  };
  recentAttempts: Array<{
    id: string;
    quizId: string;
    quizTitle: string;
    score: number;
    maxScore: number;
    accuracy: number;
    isFirstAttempt?: boolean;
    timestamp: number;
    createdAt: string;
  }>;
}

export default function ProfilePage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Redeem Code Form State
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState('');

  const fetchedEmailRef = useRef<string>('');

  useEffect(() => {
    async function loadProfile() {
      if (!authUser?.email) {
        setLoading(false);
        return;
      }
      if (fetchedEmailRef.current === authUser.email) return;
      fetchedEmailRef.current = authUser.email;

      try {
        setLoading(true);
        const res = await fetch('/api/user/profile');
        const json = await res.json();
        if (json.success && json.user) {
          setProfile(json);
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [authUser?.email]);

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim()) {
      setRedeemError('Please enter a code');
      return;
    }

    try {
      setRedeeming(true);
      setRedeemError('');
      setRedeemSuccess('');

      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: redeemCode.trim() }),
      });

      const json = await res.json();

      if (json.success) {
        setRedeemSuccess(json.message || '🎉 Code redeemed successfully!');
        setRedeemCode('');
        // Reload profile data
        const profileRes = await fetch('/api/user/profile');
        const profileJson = await profileRes.json();
        if (profileJson.success) {
          setProfile(profileJson);
        }
      } else {
        setRedeemError(json.error || 'Failed to redeem code');
      }
    } catch {
      setRedeemError('Network error. Please try again.');
    } finally {
      setRedeeming(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="glass-panel rounded-3xl p-8 h-64 animate-pulse bg-slate-900/40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel rounded-3xl p-6 h-48 animate-pulse bg-slate-900/40" />
          <div className="glass-panel rounded-3xl p-6 h-48 animate-pulse bg-slate-900/40" />
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 glass-panel rounded-3xl text-center space-y-6 border border-slate-800 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white">Sign In to View Profile</h1>
          <p className="text-xs text-slate-400 mt-2">
            Access your performance stats, active subscription, redeem codes, and candidate history.
          </p>
        </div>
        <div className="flex justify-center pt-2">
          <GoogleLoginButton label="Sign In with Google" size="large" />
        </div>
      </div>
    );
  }

  const u = profile?.user || {
    id: '',
    name: authUser.name,
    email: authUser.email,
    image: authUser.image,
    role: authUser.role || 'user',
    adminPermissions: authUser.adminPermissions || [],
    isPremium: !!authUser.isPremium,
    hasCourseAccess: !!authUser.isPremium || authUser.role === 'admin' || authUser.role === 'superadmin' || authUser.adminPermissions?.includes('access_courses'),
    premiumExpiresAt: authUser.premiumExpiresAt,
    premiumPlan: authUser.premiumPlan || 'free',
    totalScore: authUser.totalScore || 0,
    testsCompleted: authUser.testsCompleted || 0,
    averageAccuracy: 0,
    createdAt: new Date().toISOString(),
    rank: 0,
  };

  const isAdmin = u.role === 'superadmin' || u.role === 'admin';

  return (
    <div className="space-y-8">
      
      {/* Profile Header Banner */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-indigo-500/30 relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 sm:gap-6">
            <UserAvatar name={u.name} email={u.email} image={u.image} size="xl" className="border-2 border-indigo-500/40 shadow-xl" />
            
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white">{u.name}</h1>
                
                {u.role === 'superadmin' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Super Admin
                  </span>
                ) : u.role === 'admin' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Admin
                  </span>
                ) : null}

                {u.isPremium ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-400" /> Premium Member
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    Free Plan
                  </span>
                )}

                {u.hasCourseAccess && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 shadow-sm">
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" /> Full Course Access
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 font-medium">{u.email}</p>
              
              <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  Joined {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-bold text-amber-400">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  Global Rank #{u.rank || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Admin Control Panel Access CTA Button */}

        </div>
      </div>

      {/* Grid: Subscription Card & Redeem Code */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Subscription Status Card */}
        <div className="glass-card rounded-3xl p-6 border border-slate-800 space-y-5 relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <span>Subscription Status</span>
              </h2>

              {u.isPremium ? (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  ACTIVE
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                  FREE CANDIDATE
                </span>
              )}
            </div>

            {u.isPremium ? (
              <div className="bg-emerald-950/30 rounded-2xl p-4 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Full Premium Unlocked</span>
                </div>
                <p className="text-xs text-slate-300">
                  Unlimited access to all practice papers, batches, detailed step-by-step solutions, and official leaderboard entry.
                </p>
                <div className="pt-2 text-xs text-slate-400 border-t border-emerald-500/20 flex items-center justify-between">
                  <span>Plan: <strong className="text-slate-200 capitalize">{u.premiumPlan}</strong></span>
                  <span>Expires: <strong className="text-amber-300">{u.premiumExpiresAt ? new Date(u.premiumExpiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Lifetime Pass'}</strong></span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs text-slate-300">
                <p className="font-semibold text-slate-200">You are currently on the Free Candidate Pass.</p>
                <p className="text-slate-400">
                  Redeem an access code below or participate in launch events to unlock all premium batches and solution keys.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Redeem Code Input Box */}
        <div className="glass-card rounded-3xl p-6 border border-slate-800 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              <span>Redeem Promo Code</span>
            </h2>
            <form onSubmit={handleRedeemCode} className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. PREPTEA-X9K2-M7PQ"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  disabled={redeeming}
                  className="flex-1 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 uppercase tracking-wider"
                />
                <button
                  type="submit"
                  disabled={redeeming || !redeemCode.trim()}
                  className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all shrink-0 flex items-center gap-1.5"
                >
                  <span>{redeeming ? 'Activating...' : 'Redeem'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {redeemError && (
                <p className="text-xs text-rose-400 bg-rose-950/40 p-3 rounded-xl border border-rose-500/30 text-center font-medium">
                  {redeemError}
                </p>
              )}

              {redeemSuccess && (
                <p className="text-xs text-emerald-300 bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/30 text-center font-bold">
                  {redeemSuccess}
                </p>
              )}
            </form>
          </div>
        </div>

      </div>

      {/* Candidate Performance Metrics Grid */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-400" />
          <span>Performance Overview</span>
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">Total Points</span>
            <p className="text-xl font-black text-indigo-400">{u.totalScore} pts</p>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">Tests Completed</span>
            <p className="text-xl font-black text-slate-200">{u.testsCompleted}</p>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">Average Accuracy</span>
            <p className="text-xl font-black text-emerald-400">{u.averageAccuracy}%</p>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">Global Ranking</span>
            <p className="text-xl font-black text-amber-400">#{u.rank || '-'}</p>
          </div>
        </div>
      </section>

      {/* Recent Attempts Activity */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-indigo-400" />
            <span>Recent Test Attempts ({profile?.recentAttempts?.length || 0})</span>
          </h2>
          <Link href="/history" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
            <span>View All History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {profile?.recentAttempts && profile.recentAttempts.length > 0 ? (
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 sm:px-6">Test Paper</th>
                    <th className="py-3 px-4 sm:px-6 text-center">Attempt Type</th>
                    <th className="py-3 px-4 sm:px-6 text-center">Score</th>
                    <th className="py-3 px-4 sm:px-6 text-center">Accuracy</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {profile.recentAttempts.map((attempt) => (
                    <tr key={attempt.id} className="hover:bg-slate-900/40 text-slate-200 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-bold text-white">
                        {attempt.quizTitle}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center">
                        {attempt.isFirstAttempt !== false ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                            1st Official
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                            Practice Retake
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center font-bold text-indigo-400">
                        {attempt.score} / {attempt.maxScore}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center font-bold text-emerald-400">
                        {attempt.accuracy}%
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <Link
                          href={`/quiz/${attempt.quizId}/results?t=${attempt.timestamp}`}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs transition-colors inline-flex items-center gap-1"
                        >
                          <span>Solutions</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center glass-panel rounded-2xl space-y-2">
            <p className="text-xs text-slate-400">No recent test attempts recorded yet.</p>
            <Link href="/" className="inline-block text-xs text-indigo-400 font-semibold hover:underline">
              Browse Practice Papers →
            </Link>
          </div>
        )}
      </section>

    </div>
  );
}
