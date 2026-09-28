import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function AdminSkeleton() {
  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8" role="main" aria-label="Loading Admin Control Center">
      {/* Admin Topbar */}
      <section className="glass-panel rounded-3xl p-6 sm:p-8 border border-card-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-8 sm:h-9 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 max-w-full rounded" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </section>

      {/* Navigation Tabs Bar */}
      <nav className="flex items-center gap-2 overflow-x-auto p-1.5 glass-panel rounded-2xl border border-card-border" aria-label="Admin Navigation Tabs">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((t) => (
          <Skeleton key={t} className="h-9 w-28 rounded-xl shrink-0" />
        ))}
      </nav>

      {/* 4 Stats Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="glass-card rounded-2xl p-5 border border-card-border space-y-2">
            <Skeleton className="h-3.5 w-36 rounded" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </section>

      {/* Feature / Action Card Banner */}
      <section className="glass-panel rounded-3xl p-6 border border-card-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-56 rounded-lg" />
            <Skeleton className="h-4 w-96 max-w-full rounded" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </section>

      {/* Table / Data View Placeholder */}
      <section className="glass-panel rounded-3xl border border-card-border overflow-hidden">
        <div className="p-5 border-b border-card-border flex items-center justify-between">
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-9 w-64 rounded-xl" />
        </div>
        <div className="divide-y divide-card-border">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1 max-w-sm">
                  <Skeleton className="h-4 w-44 rounded" />
                  <Skeleton className="h-3 w-60 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
