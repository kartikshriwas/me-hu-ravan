import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  shimmer?: boolean;
}

export function Skeleton({ className = '', shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-xl ${shimmer ? 'skeleton-shimmer' : 'skeleton animate-pulse'} ${className}`}
      {...props}
    />
  );
}
