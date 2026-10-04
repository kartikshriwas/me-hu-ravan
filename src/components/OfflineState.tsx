'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { WifiOff, RotateCcw, ArrowDownToLine, SignalZero } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { checkUserCourseAccess } from '@/lib/batchAccess';

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
  subtitle = 'Please check your connection or watch your downloaded videos.',
}: OfflineStateProps) {
  const { user } = useAuth();
  const [retrying, setRetrying] = useState(false);

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
        <div className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-primary-500/10 blur-xl pointer-events-none animate-pulse" />
        
        {/* Outer Ring */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-900/80 border border-slate-800/90 flex items-center justify-center relative shadow-2xl">
          {/* Inner Accent Ring */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-muted-foreground shadow-inner">
            <WifiOff className="w-7 h-7 sm:w-8 sm:h-8 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="space-y-1.5 max-w-sm mx-auto">
        <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xs mx-auto">
        {hasCourseAccess ? (
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
