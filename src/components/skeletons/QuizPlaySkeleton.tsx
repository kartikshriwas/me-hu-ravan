import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function QuizPlaySkeleton() {
  return (
    <main className="w-full min-h-[85vh] px-4 sm:px-8 lg:px-12 py-6 space-y-6" role="main" aria-label="Loading Quiz Environment">
      {/* Quiz Topbar */}
      <header className="glass-panel rounded-2xl p-4 sm:p-5 border border-card-border flex items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48 sm:w-64 rounded-lg" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl hidden sm:block" />
        </div>
      </header>

      {/* Progress Bar */}
      <Skeleton className="h-2 w-full rounded-full" />

      {/* Main Examination Layout: Question Area + Question Navigator Palette */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left: Active Question Area (3 Cols) */}
        <section className="lg:col-span-3 glass-panel rounded-3xl p-6 sm:p-8 border border-card-border space-y-6">
          {/* Question Header & Action Row */}
          <div className="flex items-center justify-between pb-4 border-b border-card-border">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-28 rounded-lg" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-9 h-9 rounded-xl" />
              <Skeleton className="w-9 h-9 rounded-xl" />
            </div>
          </div>

          {/* Question Content */}
          <div className="space-y-3 py-2">
            <Skeleton className="h-6 w-full rounded-lg" />
            <Skeleton className="h-6 w-5/6 rounded-lg" />
            <Skeleton className="h-4 w-2/3 rounded" />
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((opt) => (
              <div
                key={opt}
                className="p-4 rounded-2xl border border-card-border/80 flex items-center gap-4 bg-card/40"
              >
                <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
                <Skeleton className="h-4 w-3/4 rounded" />
              </div>
            ))}
          </div>

          {/* Bottom Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-card-border">
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-28 rounded-xl" />
              <Skeleton className="h-10 w-24 rounded-xl" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-24 rounded-xl" />
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
          </div>
        </section>

        {/* Right: Question Navigator Palette (1 Col) */}
        <aside className="glass-panel rounded-3xl p-5 border border-card-border space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32 rounded-lg" />
            <Skeleton className="h-4 w-12 rounded" />
          </div>

          {/* Palette Indicators Legend */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Skeleton className="w-3 h-3 rounded-full shrink-0" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            ))}
          </div>

          {/* Numbers Grid */}
          <div className="grid grid-cols-5 gap-2 pt-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-xl" />
            ))}
          </div>

          {/* Finish Button */}
          <div className="pt-2">
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </aside>
      </div>
    </main>
  );
}
