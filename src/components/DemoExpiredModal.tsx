'use client';

import React, { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Clock, 
  Hourglass, 
  AlertCircle, 
  Send, 
  Sparkles, 
  Lock, 
  ArrowRight, 
  ExternalLink, 
  Key, 
  CheckCircle2, 
  X, 
  ShieldAlert,
  ShoppingBag
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { isCourseBatch } from '@/lib/batchAccess';

const TELEGRAM_URL = 'https://t.me/KartikShriwas';

export function DemoExpiredModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [demoMinutes, setDemoMinutes] = useState<number>(15);
  const [showRedeem, setShowRedeem] = useState(false);
  const [code, setCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState('');

  // Users with course batches or explicit course permissions are exempt from demo expiration
  const isExempt = useMemo(() => {
    if (!user) return false;
    if (user.adminPermissions?.includes('access_courses') || user.adminPermissions?.includes('*')) return true;
    if (Array.isArray(user.allowedBatches) && user.allowedBatches.some((b: string) => isCourseBatch(b))) return true;
    if (user.premiumPlan && isCourseBatch(user.premiumPlan)) return true;
    return false;
  }, [user]);

  // Extract demo minutes from user plan or param
  const extractMinutes = useCallback((planStr?: string | null, fallback = 15): number => {
    if (!planStr) return fallback;
    const match = planStr.match(/(\d+)m/);
    return match ? parseInt(match[1]) : fallback;
  }, []);

  // Trigger modal & redirect if on restricted course pages
  const triggerExpired = useCallback((minutes?: number) => {
    if (isExempt) return;
    const mins = minutes || extractMinutes(user?.premiumPlan, 15);
    setDemoMinutes(mins);
    setIsOpen(true);

    // If currently on a course or video player page, redirect to normal page (home '/')
    if (typeof window !== 'undefined') {
      const curPath = window.location.pathname;
      if (curPath.startsWith('/courses')) {
        router.push('/');
      }
    }
  }, [isExempt, extractMinutes, user?.premiumPlan, router]);

  // 1. Listen for global custom event dispatched from ActivityTracker or CustomVideoPlayer
  useEffect(() => {
    if (isExempt) return;
    const handleExpiredEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const mins = customEvent?.detail?.minutes || 15;
      triggerExpired(mins);
    };

    window.addEventListener('preptea:demo-expired', handleExpiredEvent);
    return () => window.removeEventListener('preptea:demo-expired', handleExpiredEvent);
  }, [isExempt, triggerExpired]);

  // 2. Check URL search param (?demo_expired=true&mins=15)
  useEffect(() => {
    const isExpiredParam = searchParams.get('demo_expired');
    if (isExpiredParam === 'true') {
      // Clean the query param from URL without refreshing
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('demo_expired');
        url.searchParams.delete('mins');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      }

      if (isExempt) {
        setIsOpen(false);
        return;
      }

      const minsParam = searchParams.get('mins');
      const mins = minsParam ? parseInt(minsParam) : 15;
      setDemoMinutes(mins);
      setIsOpen(true);
    }
  }, [isExempt, searchParams]);

  // 3. Real-time timer watcher for users on active demo
  useEffect(() => {
    if (!user || isExempt) return;

    const plan = user.premiumPlan || '';
    const isDemo = plan.includes('demo') || plan.includes('m_demo');

    // Case A: User's plan is already flagged as expired demo
    if (plan.startsWith('expired_demo:')) {
      const mins = extractMinutes(plan, 15);
      // If user visits a restricted route or hasn't dismissed in session, show modal
      if (pathname.startsWith('/courses')) {
        triggerExpired(mins);
      }
      return;
    }

    // Case B: User has active demo timer with premiumExpiresAt
    if (isDemo && user.premiumExpiresAt) {
      const expiresAt = new Date(user.premiumExpiresAt).getTime();
      const now = Date.now();
      const remainingMs = expiresAt - now;
      const mins = extractMinutes(plan, 15);

      if (remainingMs <= 0) {
        // Already expired
        triggerExpired(mins);
      } else {
        // Schedule countdown trigger to fire the exact moment the demo ends
        const timer = setTimeout(() => {
          triggerExpired(mins);
        }, remainingMs);

        return () => clearTimeout(timer);
      }
    }
  }, [user, isExempt, pathname, extractMinutes, triggerExpired]);

  // Handle Code Redemption inside modal
  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setRedeemError('Please enter a redeem code');
      return;
    }

    try {
      setRedeemLoading(true);
      setRedeemError('');
      setRedeemSuccess('');

      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const json = await res.json();

      if (json.success) {
        setRedeemSuccess(json.message || '🎉 Batch Access Unlocked!');
        setCode('');
        setTimeout(() => {
          setIsOpen(false);
          window.location.reload();
        }, 1200);
      } else {
        setRedeemError(json.error || 'Failed to redeem code');
      }
    } catch {
      setRedeemError('Network error. Please try again.');
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    // If closing while on courses page, redirect to home
    if (pathname.startsWith('/courses')) {
      router.push('/');
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-background/85 backdrop-blur-xl animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-expired-title"
    >
      <div className="relative w-full max-w-lg bg-[#0e1424] border border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-amber-500/20 text-foreground overflow-hidden space-y-5">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-44 bg-gradient-to-r from-amber-500/25 via-red-500/20 to-primary-500/25 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-slate-800/60 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge & Icon */}
        <div className="text-center space-y-3 pt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wide uppercase">
            <Hourglass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Demo Expired</span>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 text-black flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
            <Lock className="w-8 h-8 stroke-[2.2]" />
          </div>

          <div className="space-y-1.5">
            <h2 id="demo-expired-title" className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Your {demoMinutes}min Demo Has Ended
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Your demo access is now completed. To continue watching lessons and access the full curriculum, you have to purchase a batch.
            </p>
          </div>
        </div>

        {/* Highlight KartikShriwas Contact Box */}
        <div className="relative rounded-2xl bg-gradient-to-br from-primary-950/70 via-slate-900/90 to-amber-950/40 border border-primary-500/30 p-4 sm:p-5 space-y-3 shadow-inner">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/20 border border-primary-500/40 text-primary-400 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>Message KartikShriwas</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-500/20 text-primary-300">Fast Support</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                For any <strong className="text-white">query, question, doubt</strong>, or to <strong className="text-white">purchase your batch</strong>, message KartikShriwas directly.
              </p>
            </div>
          </div>

          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-primary-600 hover:from-sky-400 hover:via-blue-500 hover:to-primary-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <Send className="w-4 h-4 fill-white" />
            <span>Message @KartikShriwas on Telegram</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <Link
            href="/pricing"
            onClick={() => setIsOpen(false)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>View Batches & Pricing</span>
          </Link>

          <button
            type="button"
            onClick={handleClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-foreground font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Back to Home Page</span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Redeem Code Accordion */}
        <div className="pt-1 border-t border-slate-800/80">
          {!showRedeem ? (
            <button
              type="button"
              onClick={() => setShowRedeem(true)}
              className="w-full text-center text-xs text-amber-400 hover:text-amber-300 font-semibold py-1 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Already received a batch redeem code? Click here to activate</span>
            </button>
          ) : (
            <form onSubmit={handleRedeem} className="space-y-2.5 pt-2 animate-in fade-in duration-200">
              <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Enter Batch Redeem Code</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. PREPTEA-X9K2-M7PQ"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  disabled={redeemLoading}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-foreground placeholder-slate-500 focus:outline-none focus:border-amber-500 uppercase tracking-wider"
                />
                <button
                  type="submit"
                  disabled={redeemLoading || !code.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                >
                  {redeemLoading ? 'Applying...' : 'Unlock'}
                </button>
              </div>

              {redeemError && (
                <p className="text-xs text-rose-400 font-medium bg-rose-950/40 p-2 rounded-lg border border-rose-500/20 text-center">
                  {redeemError}
                </p>
              )}

              {redeemSuccess && (
                <p className="text-xs text-emerald-300 font-medium bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/20 text-center">
                  {redeemSuccess}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
