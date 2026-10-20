'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Crown, 
  ArrowDownToLine, 
  Send, 
  Sparkles, 
  Lock, 
  Key, 
  CheckCircle2, 
  X, 
  ExternalLink,
  ShieldCheck,
  Zap,
  HardDrive
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';

const TELEGRAM_URL = 'https://t.me/KartikShriwas';

export function PremiumDownloadModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [code, setCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState('');

  // 1. Listen for global custom event dispatched from any download trigger
  useEffect(() => {
    const handleRequiredEvent = () => {
      setIsOpen(true);
    };

    window.addEventListener('preptea:premium-download-required', handleRequiredEvent);
    return () => window.removeEventListener('preptea:premium-download-required', handleRequiredEvent);
  }, []);

  // Handle inline code redemption
  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || redeemLoading) return;

    setRedeemLoading(true);
    setRedeemError('');
    setRedeemSuccess('');

    try {
      const res = await fetch('/api/user/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setRedeemError(data.error || 'Invalid or expired code');
      } else {
        setRedeemSuccess(data.message || 'Code redeemed successfully! Refreshing access...');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch {
      setRedeemError('Network error while redeeming code. Please try again.');
    } finally {
      setRedeemLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-amber-500/40 shadow-[0_25px_60px_rgba(245,158,11,0.2)] p-6 sm:p-8 overflow-hidden text-center text-foreground animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Badge */}
        <div className="relative mb-5 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-indigo-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10 mb-3 animate-pulse">
            <Crown className="w-8 h-8 fill-amber-400/20 text-amber-400" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-wider">
            <Lock className="w-3 h-3 text-amber-400" />
            <span>Premium Only Feature</span>
          </div>
        </div>

        {/* Main Headings */}
        <div className="space-y-2 mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Offline Downloads Require Premium
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
            Offline video downloading is <span className="font-bold text-amber-300">not available for demo or free accounts</span>. Upgrade to Premium or purchase a batch to download lessons for offline watching!
          </p>
        </div>

        {/* Value Proposition Highlights */}
        <div className="grid grid-cols-1 gap-2.5 mb-6 text-left">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">Unlimited Offline Watching</p>
              <p className="text-[11px] text-slate-400">Save lessons in 1080p, 720p or 540p without buffering</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">Full Course Access</p>
              <p className="text-[11px] text-slate-400">Lifetime access to all modules, videos & practice tests</p>
            </div>
          </div>
        </div>

        {/* Primary Action Button: Telegram KartikShriwas */}
        <div className="space-y-3 mb-4">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-sm shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Message KartikShriwas to Buy Batch</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70 ml-0.5" />
          </a>

          {/* Toggle Redeem Code Input */}
          <button
            type="button"
            onClick={() => setShowRedeem(!showRedeem)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{showRedeem ? 'Hide Redeem Form' : 'Already have a code? Redeem here'}</span>
          </button>
        </div>

        {/* Inline Redeem Code Form */}
        {showRedeem && (
          <form onSubmit={handleRedeem} className="mt-3 p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2.5 text-left animate-in fade-in slide-in-from-top-2">
            <label className="text-[11px] font-bold text-slate-300">
              Enter Access Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. SIGMA-PREMIUM-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                autoCapitalize="characters"
              />
              <button
                type="submit"
                disabled={redeemLoading || !code.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                {redeemLoading ? 'Applying...' : 'Redeem'}
              </button>
            </div>
            {redeemError && (
              <p className="text-[11px] text-rose-400 font-medium">{redeemError}</p>
            )}
            {redeemSuccess && (
              <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {redeemSuccess}
              </p>
            )}
          </form>
        )}

        {/* Secondary Dismiss Button */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-xs text-slate-500 hover:text-slate-300 font-medium transition-colors cursor-pointer"
          >
            Got it, continue browsing
          </button>
        </div>
      </div>
    </div>
  );
}
