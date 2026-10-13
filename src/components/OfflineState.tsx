'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { WifiOff, RotateCcw, ArrowDownToLine, SignalZero } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { checkUserCourseAccess } from '@/lib/batchAccess';
import { useDownloads } from '@/lib/downloadContext';

interface OfflineStateProps {
  isPremium?: boolean;
  onRetry?: () => void;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function OfflineState({
  isPremium: isPremiumProp,
  onRetry,
  className = '',
  title = "You're offline",
  subtitle,
}: OfflineStateProps) {
  const { user } = useAuth();
  const { downloads } = useDownloads();
  const [retrying, setRetrying] = useState(false);

  const displaySubtitle =
    subtitle ||
    (downloads.length > 0
      ? 'Please check your connection or watch your downloaded videos.'
      : 'Please check your connection to continue using PrepTea.');

  const hasCourseAccess =
    isPremiumProp !== undefined
      ? isPremiumProp
      : checkUserCourseAccess(user);

  const handleRetry = () => {
    setRetrying(true);
    if (onRetry) {
      onRetry();
      setTimeout(() => setRetrying(false), 800);
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div
      className={`w-full flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-5 select-none animate-in fade-in duration-300 relative ${className}`}
    >
      {/* Icon with radar rings & glow */}
      <div className="relative flex items-center justify-center">
        {/* Soft background pulse glow */}
        <div className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-primary-500/20 blur-2xl pointer-events-none animate-pulse" />
        <div className="absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-rose-500/10 blur-3xl pointer-events-none animate-pulse delay-700" />
        
        {/* Outer Ring */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-card border border-card-border/80 flex items-center justify-center relative shadow-2xl backdrop-blur-md">
          {/* Inner Accent Ring */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-card/60 border border-card-border flex items-center justify-center shadow-inner">
            <WifiOff className="w-7 h-7 sm:w-8 sm:h-8 text-primary-500/80 drop-shadow-md" />
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="space-y-2 max-w-sm mx-auto">
        <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-br from-foreground via-foreground/90 to-primary-500/80 bg-clip-text text-transparent tracking-tight">
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {displaySubtitle}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xs mx-auto">
        {downloads.length > 0 ? (
          <>
            <Link
              href="/downloads"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs sm:text-sm transition-all shadow-xl shadow-primary-600/30 hover:scale-105 active:scale-95"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Go to downloads</span>
            </Link>

            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-foreground font-bold text-xs sm:text-sm transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
              <span>{retrying ? 'Checking...' : 'Retry'}</span>
            </button>
          </>
        ) : (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-2xl bg-primary-600 hover:bg-primary-500 disabled:opacity-75 text-white font-bold text-xs sm:text-sm transition-all shadow-xl shadow-primary-600/30 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            <span>{retrying ? 'Checking...' : 'Retry'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
