'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // 1. In development, NEVER run a Service Worker.
    // Unregister any active worker and purge all caches so Hot Reload / CSS updates are immediate.
    if (process.env.NODE_ENV === 'development') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      });
      if ('caches' in window) {
        caches.keys().then((names) => {
          for (const name of names) {
            caches.delete(name);
          }
        });
      }
      return;
    }

    // 2. Production: Register with immediate update detection and auto-reload on new version
    let refreshing = false;

    // When the new worker takes control, refresh page once to apply the new UI automatically
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    const handleLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Immediately check for updates
          registration.update();

          // Listen for new worker updates
          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Tell new worker to skip waiting and activate immediately
                  installingWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });

          // Check for updates when user refocuses or returns to the tab
          const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
              registration.update();
            }
          };
          document.addEventListener('visibilitychange', handleVisibility);
        })
        .catch((error) => {
          console.warn('Service worker registration failed:', error);
        });
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, []);

  return null;
}
