'use client';

import { useEffect, useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function TopLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setIsLoading(false);
    setProgress(100);
    
    const timeout = setTimeout(() => {
      setProgress(0);
    }, 200);

    return () => clearTimeout(timeout);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;
      
      const href = target.getAttribute('href');
      if (href && href.startsWith('/') && href !== pathname) {
        setIsLoading(true);
        setProgress(15);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [pathname]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 5;
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  if (progress === 0 && !isLoading) return null;

  return (
    <div
      className="fixed top-0 left-0 h-1 z-[9999] bg-primary-500 shadow-[0_0_10px_var(--color-primary-500)] transition-all duration-200 ease-out"
      style={{ 
        width: `${progress}%`,
        opacity: progress === 100 ? 0 : 1 
      }}
    />
  );
}

export function TopLoader() {
  return (
    <Suspense fallback={null}>
      <TopLoaderInner />
    </Suspense>
  );
}
