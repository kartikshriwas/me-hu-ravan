"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { UserAvatar } from "@/components/UserAvatar";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { ThemePicker } from "@/components/ThemePicker";
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
  BookOpen,
} from "lucide-react";
import { ProfileSkeleton } from "@/components/skeletons/ProfileSkeleton";

interface ProfileData {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
    role: "superadmin" | "admin" | "user";
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
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemSuccess, setRedeemSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "settings">(
    "overview",
  );

  const fetchedEmailRef = useRef<string>("");

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
        const res = await fetch("/api/user/profile");
        const json = await res.json();
        if (json.success && json.user) {
          setProfile(json);
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [authUser?.email]);

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim()) {
      setRedeemError("Please enter a code");
      return;
    }

    try {
      setRedeeming(true);
      setRedeemError("");
      setRedeemSuccess("");

      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: redeemCode.trim() }),
      });

      const json = await res.json();

      if (json.success) {
        setRedeemSuccess(json.message || "🎉 Code redeemed successfully!");
        setRedeemCode("");
        // Reload profile data
        const profileRes = await fetch("/api/user/profile");
        const profileJson = await profileRes.json();
        if (profileJson.success) {
          setProfile(profileJson);
        }
      } else {
        setRedeemError(json.error || "Failed to redeem code");
      }
    } catch {
      setRedeemError("Network error. Please try again.");
    } finally {
      setRedeeming(false);
    }
  };

  if (authLoading || loading) {
    return <ProfileSkeleton />;
  }

  if (!authUser) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 glass-panel rounded-3xl text-center space-y-6 border border-card-border shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center mx-auto text-primary-600 dark:text-primary-400">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            Sign In to View Profile
          </h1>
          <p className="text-xs text-muted-foreground mt-2">
            Access your performance stats, active subscription, redeem codes,
            and candidate history.
          </p>
        </div>
        <div className="flex justify-center pt-2">
          <GoogleLoginButton label="Sign In with Google" size="large" />
        </div>
      </div>
    );
  }

  const u = profile?.user || {
    id: "",
    name: authUser.name,
    email: authUser.email,
    image: authUser.image,
    role: authUser.role || "user",
    adminPermissions: authUser.adminPermissions || [],
    isPremium: !!authUser.isPremium,
    hasCourseAccess:
      !!authUser.isPremium ||
      authUser.role === "admin" ||
      authUser.role === "superadmin" ||
      authUser.adminPermissions?.includes("access_courses"),
    premiumExpiresAt: authUser.premiumExpiresAt,
    premiumPlan: authUser.premiumPlan || "free",
    totalScore: authUser.totalScore || 0,
    testsCompleted: authUser.testsCompleted || 0,
    averageAccuracy: 0,
    createdAt: new Date().toISOString(),
    rank: 0,
  };

  const isAdmin = u.role === "superadmin" || u.role === "admin";

  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8" role="main">
      {/* Profile Header Banner */}
      <header className="glass-panel rounded-3xl p-6 sm:p-8 border border-primary-500/30 relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 sm:gap-6">
            <UserAvatar
              name={u.name}
              email={u.email}
              image={u.image}
              size="xl"
              className="border-2 border-primary-500/40 shadow-xl"
            />

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                  {u.name}
                </h1>

                {u.role === "superadmin" ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-black shadow-md flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Super Admin
                  </span>
                ) : u.role === "admin" ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-600/30 text-primary-600 dark:text-primary-300 border border-primary-500/40 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Admin
                  </span>
                ) : null}

                {u.isPremium ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />{" "}
                    Premium Member
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-muted-foreground border border-slate-700">
                    Free Plan
                  </span>
                )}
              </div>

              <p className="text-xs text-foreground/80 font-medium">
                {u.email}
              </p>

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                  Joined{" "}
                  {new Date(u.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                  <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Global Rank #{u.rank || "-"}
                </span>
                {u.isPremium && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Expires:{" "}
                      {u.premiumExpiresAt
                        ? new Date(u.premiumExpiresAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )
                        : "Lifetime Pass"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2-SECTION TABS SWITCHER */}
      <div className="flex items-center gap-3 border-b border-card-border pb-4">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-extrabold transition-all ${
            activeTab === "overview"
              ? "bg-primary-600 text-white shadow-lg shadow-primary-600/30"
              : "glass-panel text-muted-foreground hover:text-foreground border border-card-border hover:bg-card/50"
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Profile</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-extrabold transition-all ${
            activeTab === "settings"
              ? "bg-primary-600 text-white shadow-lg shadow-primary-600/30"
              : "glass-panel text-muted-foreground hover:text-foreground border border-card-border hover:bg-card/50"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* SECTION 1: PROFILE OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-8 animate-fadeIn">
          {/* Performance Overview */}
          <section className="space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>Performance Overview</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-panel rounded-2xl p-5 border border-card-border space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium">
                  Total Points
                </span>
                <p className="text-2xl font-black text-primary-600 dark:text-primary-400">
                  {u.totalScore} pts
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-5 border border-card-border space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium">
                  Tests Completed
                </span>
                <p className="text-2xl font-black text-foreground">
                  {u.testsCompleted}
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-5 border border-card-border space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium">
                  Average Accuracy
                </span>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {u.averageAccuracy}%
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-5 border border-card-border space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium">
                  Global Ranking
                </span>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  #{u.rank || "-"}
                </p>
              </div>
            </div>
          </section>

          {/* Recent Test Attempts */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <span>
                  Recent Test Attempts ({profile?.recentAttempts?.length || 0})
                </span>
              </h2>
              <Link
                href="/history"
                className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 font-semibold flex items-center gap-1"
              >
                <span>View All History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {profile?.recentAttempts && profile.recentAttempts.length > 0 ? (
              <div className="glass-panel rounded-2xl border border-card-border overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-card/80 text-muted-foreground uppercase text-[11px] font-semibold border-b border-card-border">
                      <tr>
                        <th className="py-3 px-4 sm:px-6">Test Paper</th>
                        <th className="py-3 px-4 sm:px-6 text-center">
                          Attempt Type
                        </th>
                        <th className="py-3 px-4 sm:px-6 text-center">Score</th>
                        <th className="py-3 px-4 sm:px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {profile.recentAttempts.map((attempt) => (
                        <tr
                          key={attempt.id}
                          className="hover:bg-card/40 text-foreground transition-colors"
                        >
                          <td className="py-3.5 px-4 sm:px-6 font-bold text-foreground">
                            {attempt.quizTitle}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-center">
                            {attempt.isFirstAttempt !== false ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                                Official
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-bold border border-amber-500/30">
                                Retake
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-center font-bold text-primary-600 dark:text-primary-400">
                            {attempt.score} / {attempt.maxScore}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-right">
                            <Link
                              href={`/quiz/${attempt.quizId}/results?t=${attempt.timestamp}`}
                              className="px-3 py-1.5 rounded-xl bg-card hover:bg-slate-800 border border-slate-700 text-foreground font-bold text-xs transition-colors inline-flex items-center gap-1"
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
                <p className="text-xs text-muted-foreground">
                  No recent test attempts recorded yet.
                </p>
                <Link
                  href="/"
                  className="inline-block text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline"
                >
                  Browse Practice Papers →
                </Link>
              </div>
            )}
          </section>
        </div>
      )}

      {/* SECTION 2: PLATFORM PREFERENCES & REDEEM CODE */}
      {activeTab === "settings" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 animate-fadeIn">
          {/* Astra Theme Engine */}
          <section className="glass-card rounded-3xl p-6 border border-card-border space-y-6 relative overflow-hidden">
            {/* Ambient branding glow */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="space-y-3 border-b border-card-border pb-5 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <h2 className="text-lg font-black text-foreground tracking-tight">
                  Astra UI Engine
                </h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Powered by our next-generation aesthetic engine. Personalize your workspace with Astra's adaptive lighting modes and signature dynamic color accents.
              </p>
            </div>
            
            <div className="relative z-10">
              <ThemePicker />
            </div>
          </section>

          {/* Redeem Code Section */}
          <section className="glass-card rounded-3xl p-6 border border-card-border space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-card-border pb-4">
                <Key className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <span>Redeem Promo / Access Code</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Enter your access token or voucher code below to immediately
                unlock full access to premium papers, test series, and detailed
                solutions.
              </p>

              <form onSubmit={handleRedeemCode} className="space-y-4">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="e.g. PREPTEA-X9K2-M7PQ"
                    value={redeemCode}
                    onChange={(e) =>
                      setRedeemCode(e.target.value.toUpperCase())
                    }
                    disabled={redeeming}
                    className="w-full px-4 py-3.5 rounded-2xl bg-card border border-card-border text-sm font-mono font-bold text-foreground placeholder-slate-500 focus:outline-none focus:border-primary-500 uppercase tracking-wider shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={redeeming || !redeemCode.trim()}
                    className="w-full px-5 py-3.5 rounded-2xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-600/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    <span>
                      {redeeming ? "Activating Code..." : "Redeem Access Code"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {redeemError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-950/40 p-3.5 rounded-xl border border-rose-500/30 text-center font-medium">
                    {redeemError}
                  </p>
                )}

                {redeemSuccess && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-300 bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-500/30 text-center font-bold">
                    {redeemSuccess}
                  </p>
                )}
              </form>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
