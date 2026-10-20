import { Suspense } from 'react';
import { getAllAssessments } from '@/lib/questionsData';
import { HomeClient } from '@/components/HomeClient';

// Enable 60-second Incremental Static Regeneration (ISR) for instant Edge caching & TTFB < 50ms
export const revalidate = 60;

export default function HomePage() {
  const initialTests = getAllAssessments();
  return (
    <Suspense fallback={null}>
      <HomeClient initialTests={initialTests} />
    </Suspense>
  );
}
