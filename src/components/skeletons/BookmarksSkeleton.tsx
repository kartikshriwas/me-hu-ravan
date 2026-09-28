import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function BookmarksSkeleton() {
  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8" role="main" aria-label="Loading Bookmarks">
      {/* Header Banner */}
      <section className="glass-panel rounded-3xl p-6 sm:p-8 border border-card-border flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36 rounded-full" />
          <Skeleton className="h-8 sm:h-9 w-64 rounded-xl" />
          <Skeleton className="h-4 w-80 max-w-full rounded" />
        </div>
        <Skeleton className="h-10 w-24 rounded-xl shrink-0" />
      </section>

      {/* Bookmarked Questions List */}
      <section className="space-y-8">
        {[1, 2, 3].map((n) => (
          <article
            key={n}
            className="glass-card rounded-2xl p-6 sm:p-8 border border-card-border space-y-6"
          >
            {/* Question Header & Meta */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-28 rounded-lg" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              <Skeleton className="w-9 h-9 rounded-xl" />
            </div>

            {/* Question Text */}
            <div className="space-y-2">
              <Skeleton className="h-5 w-full rounded" />
              <Skeleton className="h-5 w-4/5 rounded" />
            </div>

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {[1, 2, 3, 4].map((opt) => (
                <div key={opt} className="p-4 rounded-xl border border-card-border/80 flex items-center gap-3 bg-card/40">
                  <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                </div>
              ))}
            </div>

            {/* Solution Drawer Skeleton */}
            <div className="p-4 rounded-xl border border-card-border/60 bg-card/20 space-y-2">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3.5 w-full rounded" />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
