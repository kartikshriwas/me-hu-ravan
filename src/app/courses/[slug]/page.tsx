import { notFound } from 'next/navigation';
import { getCourseBySlug } from '@/lib/coursesData';
import { getAllAssessments } from '@/lib/questionsData';
import { auth } from '@/auth';
import { hasCoursesAccess, isCourseSlugUnlocked } from '@/lib/coursesAuth';
import { CourseDetailClient } from '@/components/CourseDetailClient';


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
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6">
      <CourseDetailClient course={course} availableTests={availableTests} isUnlocked={isUnlocked} />
    </main>
  );
}
