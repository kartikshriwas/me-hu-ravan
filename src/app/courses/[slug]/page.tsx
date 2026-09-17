import { notFound } from 'next/navigation';
import { getCourseBySlug } from '@/lib/coursesData';
import { getAllAssessments } from '@/lib/questionsData';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { hasCoursesAccess, isCourseSlugUnlocked } from '@/lib/coursesAuth';
import { CourseDetailClient } from '@/components/CourseDetailClient';

export const revalidate = 0;

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const sessionUser = session?.user as any;

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

  const isUnlocked = await isCourseSlugUnlocked(sessionUser, slug);

  return <CourseDetailClient course={course} availableTests={availableTests} isUnlocked={isUnlocked} />;
}
