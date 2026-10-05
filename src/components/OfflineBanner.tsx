'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WifiOff, RotateCcw, ArrowDownToLine, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { checkUserIsPremium, checkUserCourseAccess } from '@/lib/batchAccess';

export function OfflineBanner() {
  const pathname = usePathname();
  const { user } = useAuth();
  const hasCourseAccess = checkUserCourseAccess(user);

  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  // Don't show floating banner on downloads page or full-screen quiz
  if (pathname === '/downloads' || (pathname.startsWith('/quiz/') && !pathname.includes('/results'))) {
    return null;
  }

  // When connection is restored, briefly show green "Back online" pill
  if (showReconnected && isOnline) {
    return (
      <aside
        aria-label="Network status banner"
        className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300 text-xs sm:text-sm font-semibold select-none"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>Back online</span>
      </aside>
    );
  }

  // When offline, show YouTube-style bottom bar
  if (!isOnline) {
    return (
      <aside
        aria-label="Offline status banner"
        className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-lg p-3 sm:p-4 rounded-2xl sm:rounded-full bg-slate-950/95 border border-slate-800 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5),0_0_20px_-5px_rgba(255,255,255,0.05)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center justify-between gap-3 text-foreground select-none overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-transparent to-primary-500/5 pointer-events-none" />
        
        <div className="flex items-center gap-3 min-w-0 relative z-10">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900 border border-slate-700/80 flex items-center justify-center shrink-0 text-muted-foreground shadow-inner">
            <WifiOff className="w-4 h-4 sm:w-4.5 sm:h-4.5 drop-shadow-sm" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent truncate tracking-tight">
              You&apos;re offline
            </p>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
              Please check your connection or watch your downloaded videos.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 relative z-10">
          {hasCourseAccess ? (
            <Link
              href="/downloads"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs sm:text-sm shadow-[0_0_15px_-3px_rgba(var(--primary-600),0.4)] transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>Go to downloads</span>
            </Link>
          ) : (
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs sm:text-sm shadow-[0_0_15px_-3px_rgba(var(--primary-600),0.4)] transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </aside>
    );
  }

  return null;
}
