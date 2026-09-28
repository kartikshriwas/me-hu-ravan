import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function PricingSkeleton() {
  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12 animate-fade-in" aria-busy="true" aria-label="Loading pricing plans">
      {/* Header Banner Skeleton */}
      <div className="text-center space-y-4 max-w-3xl mx-auto flex flex-col items-center">
        <Skeleton className="h-7 w-52 rounded-full" />
        <Skeleton className="h-10 sm:h-14 w-4/5 rounded-2xl" />
        <Skeleton className="h-4 sm:h-5 w-3/4 rounded-md" />

        {/* Toggle Switch Skeleton */}
        <div className="mt-4 pt-2">
          <Skeleton className="h-12 w-64 rounded-2xl" />
        </div>
      </div>

      {/* All-Access Mega Offer Card Skeleton */}
      <div className="glass-card rounded-3xl border-2 border-card-border p-6 sm:p-10 space-y-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl w-full">
            <Skeleton className="h-6 w-44 rounded-lg" />
            <Skeleton className="h-8 sm:h-10 w-3/4 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
            </div>
            <div className="flex items-center gap-4 pt-2">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-4 w-32 rounded-md" />
            </div>
          </div>

          <div className="flex flex-col items-center p-6 rounded-2xl border border-card-border space-y-4 w-full sm:w-64">
            <Skeleton className="h-12 w-36 rounded-xl" />
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </div>
      </div>

      {/* Individual Batches Grid Skeleton */}
      <div className="space-y-8">
        <div className="text-center space-y-2 flex flex-col items-center">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5].map((cardIdx) => (
            <div
              key={cardIdx}
              className={`rounded-2xl border border-card-border bg-card p-6 flex flex-col justify-between space-y-6 ${
                cardIdx === 5 ? 'lg:col-span-2' : ''
              }`}
            >
              <div className="space-y-4">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48 rounded-lg" />
                  <Skeleton className="h-3.5 w-60 rounded-md" />
                </div>
                <div className="pt-2 border-t border-card-border">
                  <Skeleton className="h-8 w-28 rounded-lg" />
                </div>
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-3.5 w-full rounded-md" />
                  <Skeleton className="h-3.5 w-5/6 rounded-md" />
                  <Skeleton className="h-3.5 w-4/5 rounded-md" />
                </div>
              </div>

              <div className="pt-2">
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
