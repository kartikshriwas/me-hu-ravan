'use client';

import React, { useState, useEffect } from 'react';
import { useDownloads } from '@/lib/downloadContext';
import { DownloadsClient } from '@/components/DownloadsClient';
import { OfflineState } from '@/components/OfflineState';

export function GlobalOfflineWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // Only enter offline screen mode if the site was loaded/reloaded while offline
  const [loadedOffline, setLoadedOffline] = useState(false);
  const { downloads } = useDownloads();

  useEffect(() => {
    setMounted(true);
    // Check network status on initial mount/reload
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoadedOffline(true);
    }

    // If loaded offline and internet reconnects, restore normal view
    const handleOnline = () => setLoadedOffline(false);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Hydration safety: render normal children on initial server & client render pass
  if (!mounted) {
    return <>{children}</>;
  }

  // If loaded/reloaded while offline, show offline screen
  if (loadedOffline) {
    if (downloads.length > 0) {
      return (
        <div className="w-full flex-1 flex flex-col">
          <DownloadsClient />
        </div>
      );
    }

    return (
      <div className="w-full flex-1 flex items-center justify-center py-12">
        <OfflineState title="You are offline" />
      </div>
    );
  }

  // Otherwise, keep the active page mounted so video playback and user activity continue uninterrupted
  return <>{children}</>;
}
