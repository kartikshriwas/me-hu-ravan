'use client';

import React, { useEffect } from 'react';
import { OfflineState } from '@/components/OfflineState';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App runtime error caught:', error);
  }, [error]);

  const isOfflineError =
    typeof navigator !== 'undefined' &&
    (!navigator.onLine ||
      error.message?.toLowerCase().includes('failed to fetch') ||
      error.message?.toLowerCase().includes('network') ||
      error.message?.toLowerCase().includes('offline'));

  if (isOfflineError) {
    return (
      <div className="flex-1 w-full flex items-center justify-center p-6 min-h-[60vh]">
        <div className="max-w-md w-full glass-panel rounded-3xl p-8 border border-card-border shadow-2xl">
          <OfflineState onRetry={() => reset()} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex items-center justify-center p-6 min-h-[60vh]">
      <div className="max-w-md w-full glass-panel rounded-3xl p-8 border border-card-border shadow-2xl text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground">Something went wrong</h2>
          <p className="text-xs text-muted-foreground">{error.message || 'An unexpected error occurred.'}</p>
        </div>
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-primary-600/30 transition-all active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Try again</span>
        </button>
      </div>
    </div>
  );
}
