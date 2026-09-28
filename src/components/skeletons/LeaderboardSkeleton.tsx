import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function LeaderboardSkeleton() {
  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-10" role="main" aria-label="Loading Leaderboard">
      {/* Header Banner */}
      <section className="glass-panel rounded-3xl p-6 sm:p-10 border border-card-border relative overflow-hidden space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-52 rounded-full" />
            <Skeleton className="h-10 w-64 rounded-xl" />
            <Skeleton className="h-4 w-96 max-w-full rounded" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </section>

      {/* Top 3 Podium Cards */}
      <section className="space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {/* #2 Silver */}
          <div className="glass-card rounded-3xl p-6 sm:p-8 border border-card-border flex flex-col items-center text-center space-y-4 md:mt-6">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-2 w-full flex flex-col items-center">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-3 w-40 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-2 w-full pt-2">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          </div>

          {/* #1 Gold - Elevated */}
          <div className="glass-card rounded-3xl p-6 sm:p-8 border border-card-border flex flex-col items-center text-center space-y-4 md:-mt-4 shadow-2xl">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="w-24 h-24 rounded-full" />
            <div className="space-y-2 w-full flex flex-col items-center">
              <Skeleton className="h-6 w-36 rounded" />
              <Skeleton className="h-3.5 w-44 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-2 w-full pt-2">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          </div>

          {/* #3 Bronze */}
          <div className="glass-card rounded-3xl p-6 sm:p-8 border border-card-border flex flex-col items-center text-center space-y-4 md:mt-8">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-2 w-full flex flex-col items-center">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-3 w-40 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-2 w-full pt-2">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Rankings Table Skeleton */}
        <div className="glass-panel rounded-3xl border border-card-border overflow-hidden">
          <div className="p-5 border-b border-card-border flex items-center justify-between">
            <Skeleton className="h-6 w-48 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
          <div className="divide-y divide-card-border">
            {[4, 5, 6, 7, 8, 9, 10].map((rank) => (
              <div key={rank} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1 max-w-xs">
                    <Skeleton className="h-4 w-36 rounded" />
                    <Skeleton className="h-3 w-48 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <Skeleton className="h-8 w-16 rounded-xl hidden sm:block" />
                  <Skeleton className="h-8 w-20 rounded-xl hidden md:block" />
                  <Skeleton className="h-8 w-24 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
