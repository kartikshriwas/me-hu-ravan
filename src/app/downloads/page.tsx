import { auth } from '@/auth';
import { hasCoursesAccess } from '@/lib/coursesAuth';
import { notFound } from 'next/navigation';
import { DownloadsClient } from '@/components/DownloadsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DownloadsPage() {
  const session = await auth();
  const sessionUser = session?.user as any;

  const allowed = await hasCoursesAccess(sessionUser);
  if (!allowed) {
    notFound();
  }

  return <DownloadsClient />;
}
