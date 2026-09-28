import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function CourseDetailSkeleton() {
  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8 animate-fade-in" aria-busy="true" aria-label="Loading course details">
      {/* Back Button Skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4 rounded-md" />
        <Skeleton className="w-24 h-4 rounded-md" />
      </div>

      {/* Course Banner Header Skeleton */}
      <div className="glass-panel rounded-3xl p-6 sm:p-10 border border-card-border space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* Title and Badge */}
        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-9 sm:h-11 w-72 sm:w-96 rounded-2xl" />
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>

        {/* Description / Keywords */}
        <div className="space-y-2 max-w-2xl">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-4/5 rounded-md" />
        </div>

        {/* Resume Learning Button Skeleton */}
        <div className="pt-1">
          <Skeleton className="h-10 w-64 rounded-xl" />
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 pt-4 border-t border-card-border/80 flex-wrap">
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded-md" />
            <Skeleton className="w-20 h-4 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded-md" />
            <Skeleton className="w-20 h-4 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded-md" />
            <Skeleton className="w-16 h-4 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded-md" />
            <Skeleton className="w-24 h-4 rounded-md" />
          </div>
        </div>
      </div>

      {/* Curriculum Header & Search Bar Skeleton */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded-md" />
            <Skeleton className="h-6 w-44 rounded-lg" />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Skeleton className="h-9 w-full sm:w-72 rounded-xl" />
            <div className="flex items-center gap-1.5 shrink-0">
              <Skeleton className="h-9 w-20 rounded-xl" />
              <Skeleton className="h-9 w-20 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Sections List Skeleton */}
        <div className="space-y-4">
          {/* Section 1 (Expanded view simulation) */}
          <div className="glass-card rounded-2xl border border-card-border overflow-hidden">
            <div className="p-5 sm:p-6 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-48 sm:w-64 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="w-6 h-6 rounded-lg" />
              </div>
            </div>

            {/* Units inside section */}
            <div className="p-5 sm:p-6 pt-0 space-y-2.5 border-t border-card-border/60 mt-1 pt-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-card/60 border border-card-border/80 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                    <div className="space-y-1 min-w-0">
                      <Skeleton className="h-4 w-40 sm:w-56 rounded-md" />
                      <Skeleton className="h-3 w-16 rounded-md" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-24 sm:w-28 rounded-lg shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Section 2, 3, 4 (Collapsed view skeletons) */}
          {[2, 3, 4].map((sNum) => (
            <div key={sNum} className="glass-card rounded-2xl border border-card-border overflow-hidden">
              <div className="p-5 sm:p-6 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <Skeleton className="h-5 w-40 sm:w-56 rounded-md" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="w-6 h-6 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
