'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WifiOff, CheckCircle2 } from 'lucide-react';
import { useDownloads } from '@/lib/downloadContext';

export function OfflineBanner() {
  const pathname = usePathname();
  const { downloads } = useDownloads();

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

  // Don't show floating banner on downloads page or full-screen quiz
  if (pathname === '/downloads' || (pathname.startsWith('/quiz/') && !pathname.includes('/results'))) {
    return null;
  }

  // When connection is restored, briefly show green "Back online" pill
  if (showReconnected && isOnline) {
    return (
      <aside
        aria-label="Network status banner"
        className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300 text-xs sm:text-sm font-semibold select-none pointer-events-none"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>Back online</span>
      </aside>
    );
  }

  // When offline, show a subtle floating non-intrusive banner that doesn't block user activity
  if (!isOnline) {
    return (
      <aside
        aria-label="Network offline banner"
        className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 sm:px-5 py-2.5 rounded-full bg-slate-900/95 border border-amber-500/40 text-amber-200 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300 text-xs sm:text-sm font-medium select-none"
      >
        <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
        <span>You are offline</span>
        {downloads.length > 0 && (
          <Link
            href="/downloads"
            className="text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors ml-1"
          >
            Open Downloads
          </Link>
        )}
      </aside>
    );
  }

  return null;
}
