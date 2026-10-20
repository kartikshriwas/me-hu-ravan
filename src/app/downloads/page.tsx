'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const DownloadsClient = dynamic(
  () => import('@/components/DownloadsClient').then((mod) => mod.DownloadsClient),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[50vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        <p className="text-xs text-muted-foreground mt-4">Loading downloads...</p>
      </div>
    ),
  }
);

export default function DownloadsPage() {
  return <DownloadsClient />;
}
