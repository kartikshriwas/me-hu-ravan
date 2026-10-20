import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { hasCoursesAccess, checkIsDemoExpired } from '@/lib/coursesAuth';
import { DownloadsClient } from '@/components/DownloadsClient';

export default async function DownloadsPage() {
  const session = await auth();
  const sessionUser = session?.user as any;

  const allowed = await hasCoursesAccess(sessionUser);
  if (!allowed) {
    notFound();
  }

  return <DownloadsClient />;
}
