import { getAllCourses } from '@/lib/coursesData';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { hasCoursesAccess, getUnlockedCourseSlugsMap } from '@/lib/coursesAuth';
import { CoursesCatalogGrid } from '@/components/CoursesCatalogGrid';


export default async function CoursesCatalogPage() {
  const session = await auth();
  const sessionUser = session?.user as any;

  const allowed = await hasCoursesAccess(sessionUser);
  if (!allowed) {
    notFound();
  }

  const allCourses = getAllCourses();
  const isSlugUnlocked = await getUnlockedCourseSlugsMap(sessionUser);

  const courses = allCourses.map((course) => ({
    ...course,
    isUnlocked: isSlugUnlocked(course.slug),
  }));

  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8">
      <CoursesCatalogGrid courses={courses} />
    </main>
  );
}
