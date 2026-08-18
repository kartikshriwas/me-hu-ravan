'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface SessionEvent {
  timestamp: number;
  type: 'navigation' | 'state_change' | 'interaction';
  details: string;
}

export function ActivityTracker() {
  const pathname = usePathname();
  const lastActivityTimeRef = useRef<number>(Date.now());
  const activeSecondsAccumRef = useRef<number>(0);
  const idleSecondsAccumRef = useRef<number>(0);
  const focusSecondsAccumRef = useRef<number>(0);
  const sessionIdRef = useRef<string>('');
  const prevStateRef = useRef<string>('active');
  const eventBufferRef = useRef<SessionEvent[]>([]);

  // 1. Initialize or restore session ID
  useEffect(() => {
    let sid = sessionStorage.getItem('preptea_session_id');
    if (!sid) {
      sid = `sess_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
      sessionStorage.setItem('preptea_session_id', sid);
    }
    sessionIdRef.current = sid;
  }, []);

  // 2. Track route navigation event
  useEffect(() => {
    if (pathname) {
      eventBufferRef.current.push({
        timestamp: Date.now(),
        type: 'navigation',
        details: `Navigated to ${pathname}`,
      });
      // Cap buffer size to 5 events max to save network bandwidth & storage
      if (eventBufferRef.current.length > 5) {
        eventBufferRef.current = eventBufferRef.current.slice(-5);
      }
    }
  }, [pathname]);

  // 3. Track user activity input events
  useEffect(() => {
    const handleUserInteraction = () => {
      lastActivityTimeRef.current = Date.now();
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
    };
  }, []);

  // 4. Heartbeat Loop with dynamic interval (15s active / 30s idle)
  useEffect(() => {
    const sendHeartbeat = async (isFinal = false) => {
      if (!sessionIdRef.current) return;

      const now = Date.now();
      const secondsSinceInteraction = Math.floor((now - lastActivityTimeRef.current) / 1000);
      const isDocumentFocused = document.hasFocus();

      let currentState: 'active' | 'idle' | 'focus' | 'background' = 'active';
      if (!isDocumentFocused) {
        currentState = 'background';
      } else if (secondsSinceInteraction > 60) {
        currentState = 'idle';
      } else if (secondsSinceInteraction > 15) {
        currentState = 'focus';
      }

      // Log state changes to event buffer
      if (prevStateRef.current !== currentState) {
        eventBufferRef.current.push({
          timestamp: now,
          type: 'state_change',
          details: `State changed to ${currentState}`,
        });
        if (eventBufferRef.current.length > 5) {
          eventBufferRef.current = eventBufferRef.current.slice(-5);
        }
        prevStateRef.current = currentState;
      }

      // 15s interval delta accounting
      const intervalSecs = 15;
      if (currentState === 'active') {
        activeSecondsAccumRef.current += intervalSecs;
        focusSecondsAccumRef.current += intervalSecs;
      } else if (currentState === 'focus') {
        focusSecondsAccumRef.current += intervalSecs;
      } else if (currentState === 'idle') {
        idleSecondsAccumRef.current += intervalSecs;
      }

      const screenRes = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '1920x1080';
      const netInfo = typeof navigator !== 'undefined' ? (navigator as any).connection?.effectiveType || '4g' : '4g';

      const payload = {
        sessionId: sessionIdRef.current,
        currentPath: pathname || '/',
        pageTitle: document.title || 'PrepTea',
        state: currentState,
        activeDeltaSeconds: activeSecondsAccumRef.current,
        idleDeltaSeconds: idleSecondsAccumRef.current,
        focusDeltaSeconds: focusSecondsAccumRef.current,
        screenResolution: screenRes,
        networkType: netInfo,
        recentEvents: eventBufferRef.current,
      };

      // Reset accumulators
      activeSecondsAccumRef.current = 0;
      idleSecondsAccumRef.current = 0;
      focusSecondsAccumRef.current = 0;

      try {
        if (isFinal && typeof navigator !== 'undefined' && navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          navigator.sendBeacon('/api/analytics/heartbeat', blob);
        } else {
          const res = await fetch('/api/analytics/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (data.terminated) {
            sessionStorage.removeItem('preptea_session_id');
            window.location.href = '/';
          }
        }
      } catch (err) {
        // Ignore network errors silently
      }
    };

    // Heartbeat every 15 seconds
    const interval = setInterval(() => sendHeartbeat(false), 15000);

    const handleBeforeUnload = () => {
      sendHeartbeat(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pathname]);

  return null;
}
