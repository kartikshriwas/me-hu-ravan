'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import { Sparkles, Flame, Gift, ArrowRight, X, Clock } from 'lucide-react';

interface EventData {
  isGlobalFree: boolean;
  globalFreeUntil: string | null;
  launchEvent: {
    title: string;
    durationDays: number;
  } | null;
}

export function EventPromoBanner() {
  const { user } = useAuth();
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function fetchActiveEvents() {
      try {
        // Session storage caching (60 sec) to eliminate extra API calls in network tab
        const cached = sessionStorage.getItem('preptea_active_events');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 60000) {
              setEventData(parsed.data);
              return;
            }
          } catch {}
        }

        const res = await fetch('/api/events/active');
        const json = await res.json();
        if (json.success) {
          setEventData(json);
          sessionStorage.setItem('preptea_active_events', JSON.stringify({
            data: json,
            timestamp: Date.now(),
          }));
        }
      } catch (err) {
        console.error('Failed to fetch active events:', err);
      }
    }
    fetchActiveEvents();
  }, []);

  // 1. Hide banner if dismissed or event data not yet loaded
  if (dismissed || !eventData) return null;

  const { isGlobalFree, globalFreeUntil, launchEvent } = eventData;

  // 2. Hide if no active events exist at all
  if (!isGlobalFree && !launchEvent) return null;

  // 3. Hide if logged in user is ALREADY a permanent/individual premium user
  const isIndividualPremiumUser = user?.role === 'superadmin' || (user?.isPremium && user?.premiumPlan !== 'free');
  if (user && isIndividualPremiumUser) {
    return null;
  }

  // 4. Target banner mode based on user status & active events
  // - Logged out visitors / new users -> Priority to Launch Event ("Sign in to get free premium")
  // - Logged in non-premium users -> Priority to Global Free Access ("Platform is free for X days")
  let displayMode: 'global_free' | 'launch_event' | null = null;

  if (!user) {
    if (launchEvent) {
      displayMode = 'launch_event';
    } else if (isGlobalFree) {
      displayMode = 'global_free';
    }
  } else {
    if (isGlobalFree) {
      displayMode = 'global_free';
    } else if (launchEvent) {
      displayMode = 'launch_event';
    }
  }

  if (!displayMode) return null;

  const formattedFreeDate = globalFreeUntil
    ? new Date(globalFreeUntil).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="w-full max-w-7xl mx-auto mb-6 px-2 sm:px-6 lg:px-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl p-4 sm:p-5 bg-gradient-to-r from-indigo-950/90 via-purple-950/80 to-slate-900 border border-indigo-500/30 shadow-2xl shadow-indigo-950/50 backdrop-blur-xl">
        {/* Ambient background glow accents */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            {/* Tag Badge */}
            {displayMode === 'global_free' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  Global Free Access Active
                </span>

                {formattedFreeDate && (
                  <span className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Free until {formattedFreeDate}
                  </span>
                )}
              </div>
            )}

            {displayMode === 'launch_event' && launchEvent && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                  <Flame className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                  New Candidate Promo Active
                </span>

                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Limited Spots Available • Few Slots Left</span>
                </span>
              </div>
            )}

            {/* Banner Title */}
            <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                {displayMode === 'global_free'
                  ? 'All Premium Tests & Solution Keys are 100% Free For Everyone!'
                  : launchEvent
                  ? launchEvent.title
                  : 'Special Access Event'}
              </span>
            </h2>

            {/* Banner Description */}
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {displayMode === 'global_free'
                ? 'Enjoy full unlocked access to all practice sets, mock tests, and detailed solution keys.'
                : !user
                ? `Sign in with your Google account now to automatically claim ${
                    launchEvent
                      ? launchEvent.durationDays >= 365
                        ? `${Math.round(launchEvent.durationDays / 365)}-Year`
                        : `${launchEvent.durationDays}-Day`
                      : ''
                  } Free Premium candidate access!`
                : 'Check your active profile rewards or practice free sets.'}
            </p>
          </div>

          {/* Action CTA */}
          <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0">
            {!user ? (
              <div className="flex items-center gap-2">
                <GoogleLoginButton label="Sign In to Claim Free Pass" size="small" />
              </div>
            ) : (
              <a
                href="#tests"
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-1.5"
              >
                <span>Start Practicing Now</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            )}

            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              title="Dismiss announcement"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
