'use client';

import React, { useState } from 'react';
import { Crown, Sparkles, Key, CheckCircle2, ArrowRight, X, Lock } from 'lucide-react';
import { useAuth } from '@/lib/authContext';

interface PremiumGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
}

export function PremiumGateModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Premium Practice Paper',
}: PremiumGateModalProps) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter a redeem code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessMsg('');

      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const json = await res.json();

      if (json.success) {
        setSuccessMsg(json.message || '🎉 Premium Access Unlocked!');
        setCode('');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
          window.location.reload();
        }, 1200);
      } else {
        setError(json.error || 'Failed to redeem code');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md glass-panel rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-2xl shadow-amber-500/10 space-y-6 overflow-hidden">
        
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/20 via-primary-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-slate-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-500 text-black flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
            <Crown className="w-8 h-8 fill-black" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground">Unlock Premium Access</h2>
            <p className="text-xs text-amber-600 dark:text-amber-300/80 font-medium mt-1">
              &quot;{title}&quot; requires an active PrepTea Candidate Pass
            </p>
          </div>
        </div>

        {/* Feature List */}
        <div className="bg-card/60 rounded-2xl p-4 border border-card-border space-y-2 text-xs text-foreground/80">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Full access to all Practice Test Papers & Batches</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Detailed step-by-step solutions & explanations</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Global Leaderboard ranking & 1st attempt tracking</span>
          </div>
        </div>

        {/* Redeem Form */}
        <form onSubmit={handleRedeem} className="space-y-3">
          <label className="block text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Have a Redeem Code?</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. PREPTEA-X9K2-M7PQ"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-card border border-card-border text-xs font-mono font-bold text-foreground placeholder-slate-500 focus:outline-none focus:border-amber-500 uppercase tracking-wider"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all shrink-0 flex items-center gap-1"
            >
              <span>{loading ? 'Redeeming...' : 'Apply'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium bg-rose-950/40 p-2.5 rounded-xl border border-rose-500/20 text-center">
              {error}
            </p>
          )}

          {successMsg && (
            <p className="text-xs text-emerald-600 dark:text-emerald-300 font-medium bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20 text-center">
              {successMsg}
            </p>
          )}
        </form>

        {/* Footer Note */}
        <div className="text-center">
          <p className="text-[11px] text-slate-500">
            Don&apos;t have a code? Ask your batch admin or check your active profile rewards.
          </p>
        </div>

      </div>
    </div>
  );
}
