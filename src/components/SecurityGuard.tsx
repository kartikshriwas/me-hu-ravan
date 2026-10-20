'use client';

import { useEffect } from 'react';

/**
 * Invisible, strict security shield:
 * Prevents DevTools inspection and network monitoring even if opened via browser 3-dots menu or extensions.
 * 
 * - When DevTools is closed: 100% normal user experience, 0 UI warnings, zero performance overhead.
 * - The moment DevTools opens (via 3-dots, shortcut, or extension):
 *   1. Instantly kills all active video/audio streams and drops media connections.
 *   2. Poisons fetch & XMLHttpRequest so no video segments or API endpoints can be logged.
 *   3. Blanks the page DOM so the Elements tab has nothing to inspect.
 *   4. Freezes DevTools execution with an aggressive debugger trap.
 *   5. When DevTools is closed, automatically reloads to cleanly restore access.
 */
export function SecurityGuard() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isDevToolsActive = false;

    // 1. Silently neutralize all console methods so no URLs, source IDs, or tokens leak
    try {
      const noop = () => {};
      const methods = [
        'log',
        'debug',
        'info',
        'warn',
        'error',
        'table',
        'dir',
        'trace',
        'group',
        'groupCollapsed',
        'clear',
      ] as const;
      methods.forEach((m) => {
        try {
          (window.console as any)[m] = noop;
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }

    // 2. Action to execute immediately when DevTools is detected as open
    const handleDevToolsOpened = () => {
      if (isDevToolsActive) return;
      isDevToolsActive = true;

      // A: Immediately terminate all video/audio streams
      try {
        const mediaElements = document.querySelectorAll('video, audio');
        mediaElements.forEach((el) => {
          const media = el as HTMLMediaElement;
          media.pause();
          media.removeAttribute('src');
          media.load();
          media.remove();
        });
      } catch {
        // ignore
      }

      // B: Poison the network layer so no video chunks or APIs can be monitored in Network tab
      try {
        window.fetch = () => Promise.reject(new Error('Network monitoring prohibited'));
        window.XMLHttpRequest = class extends XMLHttpRequest {
          override open() {
            throw new Error('Network monitoring prohibited');
          }
          override send() {
            throw new Error('Network monitoring prohibited');
          }
        };
      } catch {
        // ignore
      }

      // C: Blank out the DOM so the Elements tab has nothing to inspect
      try {
        if (document.body) {
          document.body.style.display = 'none';
        }
      } catch {
        // ignore
      }
    };

    // 3. Action to execute when DevTools is closed
    const handleDevToolsClosed = () => {
      if (!isDevToolsActive) return;
      isDevToolsActive = false;
      // Auto-reload to restore clean access once DevTools is closed
      try {
        window.location.reload();
      } catch {
        // ignore
      }
    };

    // 4. Primary Detection: Check window outer/inner dimension deltas (Docked DevTools)
    const checkDimensions = () => {
      const widthDelta = window.outerWidth - window.innerWidth;
      const heightDelta = window.outerHeight - window.innerHeight;

      // Chrome/Edge/Firefox docked devtools is at least 200px wide or high
      const isDockedOpen = widthDelta > 160 || heightDelta > 220;

      if (isDockedOpen) {
        handleDevToolsOpened();
      } else if (isDevToolsActive) {
        handleDevToolsClosed();
      }
    };

    // 5. Secondary Detection: Debugger Latency Probe (Works for Undocked / Detached DevTools)
    const probeDebuggerLatency = () => {
      const start = performance.now();
      try {
        const check = function () {
          (function () {
            return false;
          }
            ['constructor']('debugger')
            ['call']());
        };
        check();
      } catch {
        // ignore
      }
      const duration = performance.now() - start;

      // When DevTools is open, debugger pause takes > 60ms
      if (duration > 60) {
        handleDevToolsOpened();
      }
    };

    // 6. Tertiary Detection: Console evaluation getter trap
    try {
      const trap = new Image();
      Object.defineProperty(trap, 'id', {
        get: function () {
          handleDevToolsOpened();
          return 'sec';
        },
        configurable: true,
      });
      // Periodic getter probe
      setInterval(() => {
        if (isDevToolsActive) return;
        try {
          (window.console as any).dir?.(trap);
        } catch {
          // ignore
        }
      }, 2000);
    } catch {
      // ignore
    }

    // 7. Event Listeners for immediate trigger on resize (when DevTools opens via 3 dots)
    window.addEventListener('resize', checkDimensions, { passive: true });

    // Periodic detection loop
    const pollInterval = setInterval(() => {
      checkDimensions();
      probeDebuggerLatency();

      // If DevTools is active, constantly run debugger trap to freeze DevTools execution
      if (isDevToolsActive) {
        try {
          (function () {
            return false;
          }
            ['constructor']('debugger')
            ['call']());
        } catch {
          // ignore
        }
      }
    }, 200);

    // Initial check on page load
    checkDimensions();
    probeDebuggerLatency();

    // 8. Silently prevent shortcut keys
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleDevToolsOpened();
        return false;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;
      const key = (e.key || '').toUpperCase();

      if (
        (isCtrlOrMeta && isShift && ['I', 'J', 'C', 'K', 'E'].includes(key)) ||
        (isCtrlOrMeta && isAlt && ['I', 'J', 'C'].includes(key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleDevToolsOpened();
        return false;
      }

      if (isCtrlOrMeta && (key === 'U' || (isAlt && key === 'U'))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }

      if (isCtrlOrMeta && (key === 'S' || key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    };

    // 9. Silently block right-click context menu and drag
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('dragstart', handleDragStart, true);

    return () => {
      window.removeEventListener('resize', checkDimensions);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      clearInterval(pollInterval);
    };
  }, []);

  return null;
}
