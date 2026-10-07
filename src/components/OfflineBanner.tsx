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

  // When offline, we no longer show a floating banner because 
  // GlobalOfflineWrapper now intercepts all routes to show either 
  // the downloads page or a full-page OfflineState.

  return null;
}
