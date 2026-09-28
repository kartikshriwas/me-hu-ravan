import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function ProfileSkeleton() {
  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8" role="main" aria-label="Loading Profile">
      {/* Profile Header Banner */}
      <header className="glass-panel rounded-3xl p-6 sm:p-8 border border-primary-500/30 relative overflow-hidden space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* UserAvatar size="xl" is 80x80px rounded-2xl */}
            <Skeleton className="w-20 h-20 rounded-2xl shrink-0" />

            <div className="space-y-2">
              {/* Name & Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-7 sm:h-8 w-48 rounded-lg" />
                <Skeleton className="h-6 w-32 rounded-full" />
              </div>

              {/* Email */}
              <Skeleton className="h-4 w-44 rounded" />

              {/* Joined Date, Rank, and Expiry info */}
              <div className="flex items-center gap-3 pt-1 flex-wrap">
                <Skeleton className="h-3.5 w-28 rounded" />
                <span className="text-muted-foreground/40">•</span>
                <Skeleton className="h-3.5 w-32 rounded" />
                <span className="text-muted-foreground/40">•</span>
                <Skeleton className="h-3.5 w-36 rounded" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2-Section Tabs Switcher: Matches exact border-b & button styling */}
      <div className="flex items-center gap-3 border-b border-card-border pb-4">
        <Skeleton className="h-11 w-32 rounded-2xl" />
        <Skeleton className="h-11 w-32 rounded-2xl" />
      </div>

      {/* Section 1: Overview Tab (Active by Default) */}
      <div className="space-y-8">
        {/* Performance Overview Heading & 4-Metric Grid */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded-md shrink-0" />
            <Skeleton className="h-5 w-44 rounded-lg" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="glass-panel rounded-2xl p-5 border border-card-border space-y-2"
              >
                <Skeleton className="h-3.5 w-24 rounded" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </section>

        {/* Recent Test Attempts Heading & Table */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="w-5 h-5 rounded-md shrink-0" />
              <Skeleton className="h-5 w-48 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-28 rounded" />
          </div>

          {/* Attempts Table Card */}
          <div className="glass-panel rounded-2xl border border-card-border overflow-hidden shadow-xl">
            {/* Table Header */}
            <div className="bg-card/80 p-3.5 sm:px-6 border-b border-card-border grid grid-cols-12 gap-4 items-center">
              <div className="col-span-5 sm:col-span-6">
                <Skeleton className="h-3.5 w-24 rounded" />
              </div>
              <div className="col-span-3 sm:col-span-2 flex justify-center">
                <Skeleton className="h-3.5 w-20 rounded" />
              </div>
              <div className="col-span-2 sm:col-span-2 flex justify-center">
                <Skeleton className="h-3.5 w-14 rounded" />
              </div>
              <div className="col-span-2 sm:col-span-2 flex justify-end">
                <Skeleton className="h-3.5 w-16 rounded" />
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-card-border/60">
              {[1, 2, 3, 4, 5].map((row) => (
                <div
                  key={row}
                  className="py-4 px-4 sm:px-6 grid grid-cols-12 gap-4 items-center"
                >
                  <div className="col-span-5 sm:col-span-6 space-y-1">
                    <Skeleton className="h-4 sm:h-5 w-48 sm:w-64 max-w-full rounded" />
                  </div>
                  <div className="col-span-3 sm:col-span-2 flex justify-center">
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </div>
                  <div className="col-span-2 sm:col-span-2 flex justify-center">
                    <Skeleton className="h-5 w-16 rounded" />
                  </div>
                  <div className="col-span-2 sm:col-span-2 flex justify-end">
                    <Skeleton className="h-8 w-20 sm:w-24 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
