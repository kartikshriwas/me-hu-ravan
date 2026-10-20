import { auth } from '@/auth';
import { hasCoursesAccess } from '@/lib/coursesAuth';
import { notFound } from 'next/navigation';

export default async function CoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const sessionUser = session?.user as any;

  const allowed = await hasCoursesAccess(sessionUser);
  if (!allowed) {
    notFound();
  }

  return <>{children}</>;
}
