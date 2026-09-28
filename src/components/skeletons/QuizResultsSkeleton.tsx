import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function QuizResultsSkeleton() {
  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8" role="main" aria-label="Loading Quiz Results">
      {/* Score Summary Hero Banner */}
      <section className="glass-panel rounded-3xl p-6 sm:p-10 border border-card-border flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <Skeleton className="w-28 h-28 rounded-full shrink-0" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-32 rounded-full mx-auto sm:mx-0" />
            <Skeleton className="h-8 sm:h-9 w-64 rounded-xl mx-auto sm:mx-0" />
            <Skeleton className="h-4 w-80 max-w-full rounded mx-auto sm:mx-0" />
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <Skeleton className="h-7 w-28 rounded-xl" />
              <Skeleton className="h-7 w-28 rounded-xl" />
              <Skeleton className="h-7 w-28 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Skeleton className="h-11 w-32 rounded-xl" />
          <Skeleton className="h-11 w-32 rounded-xl" />
        </div>
      </section>

      {/* Telemetry Metrics 4-Cards Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((m) => (
          <div key={m} className="glass-card rounded-2xl p-5 border border-card-border space-y-2">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
        ))}
      </section>

      {/* Detailed Question Review List */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-52 rounded-lg" />
          <Skeleton className="h-5 w-24 rounded" />
        </div>

        <div className="space-y-6">
          {[1, 2, 3].map((n) => (
            <article
              key={n}
              className="glass-card rounded-2xl p-6 sm:p-8 border border-card-border space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-28 rounded-lg" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="w-8 h-8 rounded-xl" />
              </div>

              <div className="space-y-2">
                <Skeleton className="h-5 w-full rounded" />
                <Skeleton className="h-5 w-4/5 rounded" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {[1, 2, 3, 4].map((opt) => (
                  <Skeleton key={opt} className="h-14 rounded-xl" />
                ))}
              </div>

              <div className="p-4 rounded-xl border border-card-border/60 bg-card/20 space-y-2">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3.5 w-full rounded" />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
