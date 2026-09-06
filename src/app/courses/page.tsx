import { getAllCourses } from '@/lib/coursesData';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { verifySessionToken } from '@/lib/session';
import { hasCoursesAccess, isCourseSlugUnlocked } from '@/lib/coursesAuth';
import { CoursesCatalogGrid } from '@/components/CoursesCatalogGrid';

export const revalidate = 0;

export default async function CoursesCatalogPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('preptea_session')?.value;
  const sessionUser = verifySessionToken(sessionCookie);

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
    <div className="space-y-8">
      <CoursesCatalogGrid courses={courses} />
    </div>
  );
}
