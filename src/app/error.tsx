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

  const isChunkError =
    error.name === 'ChunkLoadError' ||
    error.message?.toLowerCase().includes('loading chunk') ||
    error.message?.toLowerCase().includes('chunkloaderror');

  const isOfflineError =
    typeof navigator !== 'undefined' &&
    (!navigator.onLine ||
      isChunkError ||
      error.message?.toLowerCase().includes('failed to fetch') ||
      error.message?.toLowerCase().includes('network') ||
      error.message?.toLowerCase().includes('offline'));

  // If online and a chunk failed to load (new Vercel deployment), auto-reload once to fetch fresh bundles
  useEffect(() => {
    if (isChunkError && typeof window !== 'undefined' && navigator.onLine) {
      const reloadKey = `chunk_reload_${error.digest || 'latest'}`;
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, 'true');
        window.location.reload();
      }
    }
  }, [isChunkError, error]);

  const handleRetry = () => {
    if (typeof window !== 'undefined' && isChunkError) {
      window.location.reload();
    } else {
      reset();
    }
  };

  if (isOfflineError && (typeof navigator === 'undefined' || !navigator.onLine)) {
    return (
      <div className="flex-1 w-full flex items-center justify-center p-6 min-h-[60vh]">
        <div className="max-w-md w-full glass-panel rounded-3xl p-8 border border-card-border shadow-2xl">
          <OfflineState onRetry={handleRetry} />
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
          <h2 className="text-lg font-bold text-foreground">
            {isChunkError ? 'New update available' : 'Something went wrong'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isChunkError
              ? 'A newer version of PrepTea was deployed. Reloading will sync the latest updates.'
              : error.message || 'An unexpected error occurred.'}
          </p>
        </div>
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-primary-600/30 transition-all active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{isChunkError ? 'Reload App' : 'Try again'}</span>
        </button>
      </div>
    </div>
  );
}
