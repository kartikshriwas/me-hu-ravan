'use client';

import React, { useState, useEffect } from 'react';
import { useDownloads } from '@/lib/downloadContext';
import { DownloadsClient } from '@/components/DownloadsClient';
import { OfflineState } from '@/components/OfflineState';

export function GlobalOfflineWrapper({ children }: { children: React.ReactNode }) {
  const { downloads } = useDownloads();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
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

  if (!isOnline) {
    if (downloads.length > 0) {
      return (
        <div className="w-full fade-in animate-in duration-500">
          <DownloadsClient />
        </div>
      );
    }
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center py-12 px-4 fade-in animate-in duration-500">
        <div className="max-w-md w-full glass-panel rounded-3xl p-8 border border-card-border shadow-2xl">
          <OfflineState
            title="You're offline"
            subtitle="Please check your internet connection."
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
