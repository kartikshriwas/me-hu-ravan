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
  const lastHeartbeatTimeRef = useRef<number>(Date.now());

  // Helper to check if video or audio is actively playing on the page
  const checkIsMediaPlaying = () => {
    try {
      if (typeof window !== 'undefined' && (window as any).__preptea_media_playing) {
        return true;
      }
      if (typeof document !== 'undefined') {
        const mediaElements = Array.from(
          document.querySelectorAll('video, audio')
        ) as (HTMLVideoElement | HTMLAudioElement)[];
        return mediaElements.some((m) => !m.paused && !m.ended && m.readyState > 2);
      }
    } catch (e) {
      // ignore
    }
    return false;
  };

  // 1. Initialize or restore browser-wide device session ID
  // Uses localStorage so all tabs in the same browser share 1 device session
  useEffect(() => {
    let sid = localStorage.getItem('preptea_device_session_id');
    if (!sid) {
      sid = `sess_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
      localStorage.setItem('preptea_device_session_id', sid);
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
      if (eventBufferRef.current.length > 5) {
        eventBufferRef.current = eventBufferRef.current.slice(-5);
      }
    }
  }, [pathname]);

  // 3. Track user activity input & media playback events
  useEffect(() => {
    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastActivityTimeRef.current > 1000) {
        lastActivityTimeRef.current = now;
      }
    };

    const interactionEvents = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
      'pointermove',
      'wheel',
      'focus',
    ];
    interactionEvents.forEach((evt) =>
      window.addEventListener(evt, handleUserInteraction, { passive: true })
    );

    // Media playback events (keep active timestamp updated continuously when playing media)
    const mediaEvents = ['timeupdate', 'playing', 'play'];
    mediaEvents.forEach((evt) =>
      window.addEventListener(evt, handleUserInteraction, { capture: true, passive: true })
    );

    return () => {
      interactionEvents.forEach((evt) =>
        window.removeEventListener(evt, handleUserInteraction)
      );
      mediaEvents.forEach((evt) =>
        window.removeEventListener(evt, handleUserInteraction, { capture: true })
      );
    };
  }, []);

  // 4. Heartbeat Loop (every 15s)
  useEffect(() => {
    const sendHeartbeat = async (isFinal = false) => {
      if (!sessionIdRef.current) return;

      const now = Date.now();
      const isMedia = checkIsMediaPlaying();

      // If media is actively playing, continuously refresh last activity timestamp
      if (isMedia) {
        lastActivityTimeRef.current = now;
      }

      const secondsSinceInteraction = Math.floor(
        (now - lastActivityTimeRef.current) / 1000
      );
      const isDocumentHidden =
        typeof document !== 'undefined' && document.visibilityState === 'hidden';

      let currentState: 'active' | 'idle' | 'focus' | 'background' = 'active';

      if (isMedia) {
        // Video lecture / audio actively playing -> Active watching state
        currentState = 'active';
      } else if (isDocumentHidden) {
        // Tab is hidden / minimized and NO video is playing -> Background
        currentState = 'background';
      } else if (secondsSinceInteraction > 180) {
        // Candidate has been away (> 3 mins) with no video playing -> Idle
        currentState = 'idle';
      } else if (secondsSinceInteraction > 30) {
        // Candidate is reading / studying on screen without mouse movement -> Focus
        currentState = 'focus';
      } else {
        // Active mouse / keyboard input within last 30s -> Active
        currentState = 'active';
      }

      if (currentState === 'active' || currentState === 'focus') {
        localStorage.setItem(`preptea_last_active_${sessionIdRef.current}`, now.toString());
      } else if (currentState === 'background') {
        const lastActiveStr = localStorage.getItem(`preptea_last_active_${sessionIdRef.current}`);
        const lastActiveTime = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;
        if (now - lastActiveTime < 25000) {
          // Another tab in this browser is active — maintain device active state
          currentState = 'active';
        }
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

      // 30s interval delta accounting
      const intervalSecs = Math.max(1, Math.min(60, Math.floor((now - (lastHeartbeatTimeRef.current || now)) / 1000)));
      lastHeartbeatTimeRef.current = now;

      if (currentState === 'active' || currentState === 'focus') {
        // BOTH Active and Focus count towards candidate's active usage time on site!
        activeSecondsAccumRef.current += intervalSecs;
        focusSecondsAccumRef.current += intervalSecs;
      } else if (currentState === 'idle') {
        idleSecondsAccumRef.current += intervalSecs;
      }

      const screenRes =
        typeof window !== 'undefined'
          ? `${window.innerWidth}x${window.innerHeight}`
          : '1920x1080';
      const netInfo =
        typeof navigator !== 'undefined'
          ? (navigator as any).connection?.effectiveType || '4g'
          : '4g';

      const payload = {
        sessionId: sessionIdRef.current,
        currentPath: pathname || '/',
        pageTitle: (typeof document !== 'undefined' && document.title) || 'PrepTea',
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
          const blob = new Blob([JSON.stringify(payload)], {
            type: 'application/json',
          });
          navigator.sendBeacon('/api/analytics/heartbeat', blob);
        } else {
          const res = await fetch('/api/analytics/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (data.terminated) {
            // Clear the terminated device session from localStorage
            localStorage.removeItem('preptea_device_session_id');
            sessionStorage.removeItem('preptea_session_id');
            const newSid = `sess_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
            localStorage.setItem('preptea_device_session_id', newSid);
            sessionIdRef.current = newSid;
            // Complete NextAuth logout to revoke user session cookie
            const { signOut } = await import('next-auth/react');
            await signOut({ callbackUrl: '/?error=SessionTerminated' });
          }
        }
      } catch (err) {
        // Ignore network errors silently
      }
    };

    // Heartbeat every 30 seconds (efficient, cuts requests by 50%)
    const interval = setInterval(() => {
      // Pause heartbeat loop when tab is hidden and not playing media
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && !checkIsMediaPlaying()) {
        return;
      }
      sendHeartbeat(false);
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !checkIsMediaPlaying()) {
        sendHeartbeat(true);
      } else if (document.visibilityState === 'visible') {
        lastActivityTimeRef.current = Date.now();
        sendHeartbeat(false);
      }
    };

    const handleBeforeUnload = () => {
      sendHeartbeat(true);
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pathname]);

  return null;
}
