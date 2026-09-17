import { getAllCourses } from '@/lib/coursesData';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { hasCoursesAccess, isCourseSlugUnlocked } from '@/lib/coursesAuth';
import { CoursesCatalogGrid } from '@/components/CoursesCatalogGrid';

export const revalidate = 0;

export default async function CoursesCatalogPage() {
  const session = await auth();
  const sessionUser = session?.user as any;

  const allowed = await hasCoursesAccess(sessionUser);
  if (!allowed) {
    notFound();
  }

  const allCourses = getAllCourses();

  const courses = await Promise.all(
    allCourses.map(async (course) => {
      const isUnlocked = await isCourseSlugUnlocked(sessionUser, course.slug);
      return { ...course, isUnlocked };
    })
  );

  return (
    <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-8">
      <CoursesCatalogGrid courses={courses} />
    </div>
  );
}
