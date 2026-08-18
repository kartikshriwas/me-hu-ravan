import { notFound } from 'next/navigation';
import { getCourseBySlug } from '@/lib/coursesData';
import { getAllAssessments } from '@/lib/questionsData';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/session';
import { hasCoursesAccess } from '@/lib/coursesAuth';
import { CourseDetailClient } from '@/components/CourseDetailClient';

export const revalidate = 0;

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('preptea_session')?.value;
  const sessionUser = verifySessionToken(sessionCookie);

  const allowed = await hasCoursesAccess(sessionUser);
  if (!allowed) {
    notFound();
  }

  const { slug } = await params;
  const course = getCourseBySlug(slug);
  const availableTests = getAllAssessments();

  if (!course) {
    notFound();
  }

  return <CourseDetailClient course={course} availableTests={availableTests} />;
}
