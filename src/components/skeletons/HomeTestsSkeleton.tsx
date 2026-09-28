import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function HomeTestsSkeleton() {
  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8" role="main" aria-label="Loading Practice Tests">
      {/* Top Search & Filter Skeleton */}
      <section className="glass-panel rounded-2xl p-4 sm:p-5 border border-card-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xl">
        <div className="relative flex-1">
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-card/90 border border-card-border">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-7 w-14 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
      </section>

      {/* Recent Activity Resume Banner Skeleton */}
      <section className="glass-panel rounded-2xl p-5 border border-card-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
          <div className="space-y-2">
            <Skeleton className="w-24 h-3.5 rounded" />
            <Skeleton className="w-48 h-4.5 rounded" />
            <Skeleton className="w-36 h-3 rounded" />
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Skeleton className="w-28 h-10 rounded-xl" />
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        </div>
      </section>

      {/* Tests Catalog Grid Skeleton */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-64 rounded-lg" />
            <Skeleton className="h-4 w-96 max-w-full rounded" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <article
              key={n}
              className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col justify-between border border-card-border space-y-5"
            >
              {/* Card Header */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded-md" />
                    <Skeleton className="h-4 w-14 rounded" />
                  </div>
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-6 w-5/6 rounded-lg" />
                  <Skeleton className="h-3.5 w-full rounded" />
                  <Skeleton className="h-3.5 w-2/3 rounded" />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((m) => (
                    <Skeleton key={m} className="h-10 rounded-xl" />
                  ))}
                </div>
                <Skeleton className="h-8 rounded-xl" />
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
