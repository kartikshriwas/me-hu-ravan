'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldCheck, Trophy, CheckCircle2, ArrowLeft, X } from 'lucide-react';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';

interface SignInRequiredProps {
  title?: string;
  subtitle?: string;
  testTitle?: string;
  onClose?: () => void;
  isModal?: boolean;
}

export function SignInRequired({
  title = 'Sign In Required',
  subtitle = 'Please sign in with your Google account to continue.',
  testTitle,
  onClose,
  isModal = false,
}: SignInRequiredProps) {
  const router = useRouter();

  const content = (
    <div className="w-full max-w-md mx-auto glass-panel rounded-3xl p-6 sm:p-8 border border-indigo-500/30 shadow-2xl space-y-6 relative overflow-hidden bg-slate-950/90 backdrop-blur-xl">
      
      {/* Optional Top Close Button for Modals */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Header Icon */}
      <div className="flex justify-center pt-2">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
          <Lock className="w-7 h-7" />
        </div>
      </div>

      {/* Main Title & Subtitle */}
      <div className="text-center space-y-2">
        <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
          {title}
        </h2>
        {testTitle && (
          <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 my-1 max-w-full truncate">
            {testTitle}
          </div>
        )}
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xs mx-auto">
          {subtitle}
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="bg-slate-900/70 rounded-2xl p-4 border border-slate-800/80 space-y-2.5 text-xs text-slate-300">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Secure Google 1-Click Authentication</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Rank on Official Candidate Leaderboards</span>
        </div>
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Save attempt history & view solutions</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-1 flex flex-col items-center w-full">
        <div className="w-full flex justify-center">
          <GoogleLoginButton label="Sign In with Google" size="large" />
        </div>

        {/* {onClose ? (
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors py-1 font-medium"
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={() => router.push('/')}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 py-1 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Test Hub</span>
          </button>
        )} */}
      </div>

    </div>
  );

  React.useEffect(() => {
    if (!isModal || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModal, onClose]);

  if (isModal) {
    return (
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) {
            onClose();
          }
        }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      >
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      {content}
    </div>
  );
}
