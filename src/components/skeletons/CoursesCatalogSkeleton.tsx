import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function CoursesCatalogSkeleton() {
  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8 animate-fade-in" aria-busy="true" aria-label="Loading course catalog">
      {/* Top Controls Row: Tabs, Search Bar, Subcategory Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pb-2">
        {/* Section Toggle Pill */}
        <div className="inline-flex p-1.5 rounded-2xl bg-card border border-card-border shrink-0 gap-1.5 w-fit">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>

        {/* Search Bar Skeleton */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>

        {/* Subcategory Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-background/60 rounded-xl border border-card-border/80 overflow-x-auto w-fit">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-lg shrink-0" />
          ))}
        </div>
      </div>

      {/* Grid of Course Cards (8 cards skeleton) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((cardIdx) => (
          <div
            key={cardIdx}
            className="glass-card rounded-2xl p-6 h-full flex flex-col justify-between border border-card-border space-y-6"
          >
            <div className="space-y-4">
              {/* Header: Title and Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <Skeleton className="h-6 w-3/4 rounded-lg" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                </div>
                <Skeleton className="w-7 h-7 rounded-xl shrink-0" />
              </div>

              {/* Description */}
              <div className="space-y-1.5 pt-1">
                <Skeleton className="h-3.5 w-full rounded-md" />
                <Skeleton className="h-3.5 w-4/5 rounded-md" />
              </div>

              {/* Course Meta Stats: Sections, Videos, Hours */}
              <div className="flex items-center gap-3 pt-3 border-t border-card-border/60 text-xs flex-wrap">
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-4 w-14 rounded-md" />
              </div>
            </div>

            {/* Bottom Button Skeleton */}
            <div className="pt-2">
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
