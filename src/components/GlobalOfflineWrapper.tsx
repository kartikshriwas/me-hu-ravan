'use client';

import React from 'react';

export function GlobalOfflineWrapper({ children }: { children: React.ReactNode }) {
  // Always keep children mounted so user activity (video, test, reading) is never interrupted
  return <>{children}</>;
}
