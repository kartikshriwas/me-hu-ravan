'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { Sparkles, CheckCircle2, AlertCircle, X, ArrowRight } from 'lucide-react';

function AutoRedeemContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'pending';
    message: string;
    code?: string;
  }>({ show: false, type: 'pending', message: '' });

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const urlCode = searchParams.get('redeem');

    if (urlCode && urlCode.trim().length >= 4) {
      const cleanCode = urlCode.trim().toUpperCase();
      sessionStorage.setItem('pending_redeem_code', cleanCode);

      // Clean parameter from URL without triggering a page reload
      const newUrl = window.location.pathname + window.location.search.replace(/([?&])redeem=[^&]*&?/, '$1').replace(/[?&]$/, '');
      window.history.replaceState({}, '', newUrl);

      if (!user) {
        setToast({
          show: true,
          type: 'pending',
          message: `Promo code "${cleanCode}" saved! Please sign in to activate.`,
          code: cleanCode,
        });
      }
    }
  }, [searchParams, user]);

  // Attempt auto-redemption when user is authenticated and pending_redeem_code exists
  useEffect(() => {
    if (!user || isProcessing) return;

    const pendingCode = sessionStorage.getItem('pending_redeem_code');
    if (!pendingCode) return;

    async function doAutoRedeem(codeToRedeem: string) {
      try {
        setIsProcessing(true);
        setToast({
          show: true,
          type: 'pending',
          message: `Activating promo code "${codeToRedeem}"...`,
          code: codeToRedeem,
        });

        const res = await fetch('/api/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeToRedeem }),
        });

        const json = await res.json();
        sessionStorage.removeItem('pending_redeem_code');

        if (json.success) {
          await refreshUser();
          setToast({
            show: true,
            type: 'success',
            message: json.message || `Code ${codeToRedeem} activated successfully!`,
            code: codeToRedeem,
          });
        } else {
          setToast({
            show: true,
            type: 'error',
            message: json.error || 'Failed to redeem code',
            code: codeToRedeem,
          });
        }
      } catch (err) {
        console.error('Auto-redeem error:', err);
        sessionStorage.removeItem('pending_redeem_code');
        setToast({
          show: true,
          type: 'error',
          message: 'Network error while auto-redeeming code',
        });
      } finally {
        setIsProcessing(false);
      }
    }

    doAutoRedeem(pendingCode);
  }, [user, isProcessing, refreshUser]);

  if (!toast.show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-300">
      <div
        className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start gap-3 relative overflow-hidden ${
          toast.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
            : toast.type === 'error'
            ? 'bg-rose-950/90 border-rose-500/50 text-rose-100'
            : 'bg-indigo-950/90 border-indigo-500/50 text-indigo-100'
        }`}
      >
        <div className="p-2 rounded-xl bg-white/10 shrink-0">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          ) : (
            <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
          )}
        </div>

        <div className="flex-1 space-y-1 pr-6">
          <h4 className="text-xs font-black uppercase tracking-wider opacity-80">
            {toast.type === 'success'
              ? 'Code Redeemed'
              : toast.type === 'error'
              ? 'Redemption Error'
              : 'Promo Code Detected'}
          </h4>
          <p className="text-xs font-semibold leading-relaxed">{toast.message}</p>

          {toast.type === 'success' && (
            <div className="pt-2">
              <button
                onClick={() => {
                  setToast((prev) => ({ ...prev, show: false }));
                  router.push('/profile');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition-colors"
              >
                <span>View Profile & Access</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setToast((prev) => ({ ...prev, show: false }))}
          className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function AutoRedeemHandler() {
  return (
    <Suspense fallback={null}>
      <AutoRedeemContent />
    </Suspense>
  );
}
