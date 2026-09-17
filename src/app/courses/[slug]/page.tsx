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

  return (
    <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <CourseDetailClient course={course} availableTests={availableTests} isUnlocked={isUnlocked} />
    </div>
  );
}
