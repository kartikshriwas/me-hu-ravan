import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function VideoViewSkeleton() {
  return (
    <div
      className="w-full flex flex-col min-h-0 h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] lg:h-[calc(100vh-5rem)] overflow-hidden animate-fade-in"
      aria-busy="true"
      aria-label="Loading video player"
    >
      <div className="flex flex-col flex-1 min-h-0 lg:grid lg:grid-cols-12 lg:gap-4 xl:gap-6 lg:border-t lg:border-card-border/60 px-2 sm:px-4 lg:px-6 py-2 sm:py-3">
        {/* Main Video Player Area */}
        <div className="flex flex-col shrink-0 min-w-0 lg:col-span-8 xl:col-span-9 space-y-3">
          {/* 16:9 Aspect Ratio Video Frame */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden glass-panel border border-card-border flex items-center justify-center bg-slate-950/80">
            <Skeleton className="w-16 h-16 rounded-full" />
            
            {/* Simulated Player Controls Bar at bottom */}
            <div className="absolute bottom-0 inset-x-0 p-4 flex items-center justify-between gap-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <Skeleton className="w-16 h-3 rounded-md" />
              </div>
              <Skeleton className="flex-1 h-1.5 rounded-full max-w-md mx-4" />
              <div className="flex items-center gap-2">
                <Skeleton className="w-7 h-7 rounded-lg" />
                <Skeleton className="w-7 h-7 rounded-lg" />
                <Skeleton className="w-7 h-7 rounded-lg" />
              </div>
            </div>
          </div>

          {/* Under-player Title & Navigation Row */}
          <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-2xl glass-card border border-card-border">
            <div className="space-y-1.5 min-w-0 flex-1">
              <Skeleton className="h-5 w-64 sm:w-80 rounded-md" />
              <Skeleton className="h-3.5 w-32 rounded-md" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Sidebar Playlist Skeleton */}
        <div className="flex-1 min-h-0 overflow-hidden min-w-0 lg:col-span-4 xl:col-span-3 flex flex-col glass-panel rounded-2xl border border-card-border p-4 space-y-4">
          {/* Sidebar Header */}
          <div className="space-y-1.5 pb-3 border-b border-card-border">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-5 w-44 rounded-md" />
          </div>

          {/* Playlist Items List */}
          <div className="flex-1 space-y-2 overflow-hidden">
            {[1, 2, 3, 4, 5, 6, 7].map((itemIdx) => (
              <div
                key={itemIdx}
                className="p-3 rounded-xl bg-card/60 border border-card-border flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
                  <div className="space-y-1 min-w-0 flex-1">
                    <Skeleton className="h-3.5 w-full rounded-md" />
                    <Skeleton className="h-3 w-16 rounded-md" />
                  </div>
                </div>
                <Skeleton className="w-4 h-4 rounded shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
