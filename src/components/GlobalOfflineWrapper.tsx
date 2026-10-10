'use client';

import React, { useState, useEffect } from 'react';
import { useDownloads } from '@/lib/downloadContext';
import { DownloadsClient } from '@/components/DownloadsClient';
import { OfflineState } from '@/components/OfflineState';

export function GlobalOfflineWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const { downloads } = useDownloads();

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Hydration safety: render normal children on initial server & client render pass
  if (!mounted) {
    return <>{children}</>;
  }

  // When online, render requested page normally
  if (isOnline) {
    return <>{children}</>;
  }

  // If user has downloaded videos, display the downloads client on any page when offline
  if (downloads.length > 0) {
    return (
      <div className="w-full flex-1 flex flex-col">
        <DownloadsClient />
      </div>
    );
  }

  // If user has NO downloaded videos, display the full-page OfflineState component
  return (
    <div className="w-full flex-1 flex items-center justify-center py-12">
      <OfflineState title="You are offline" />
    </div>
  );
}
