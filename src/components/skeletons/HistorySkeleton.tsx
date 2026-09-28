import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function HistorySkeleton() {
  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8" role="main" aria-label="Loading Test History">
      {/* Header Banner */}
      <section className="glass-panel rounded-3xl p-6 sm:p-8 border border-card-border flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36 rounded-full" />
          <Skeleton className="h-8 sm:h-9 w-56 rounded-xl" />
          <Skeleton className="h-4 w-80 max-w-full rounded" />
        </div>
        <Skeleton className="h-10 w-28 rounded-xl shrink-0" />
      </section>

      {/* Attempts Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <article
            key={n}
            className="glass-card rounded-2xl p-5 border border-card-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="space-y-3 flex-1 w-full">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
              <Skeleton className="h-5 w-3/4 rounded-lg" />
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
              <Skeleton className="h-10 w-28 rounded-xl flex-1 sm:flex-initial" />
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
