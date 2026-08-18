import Link from 'next/link';
import { getAllCourses } from '@/lib/coursesData';
import { BookOpen, Layers, Brain, ArrowRight } from 'lucide-react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { verifySessionToken } from '@/lib/session';
import { hasCoursesAccess } from '@/lib/coursesAuth';

export const revalidate = 0;

export default async function CoursesCatalogPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('preptea_session')?.value;
  const sessionUser = verifySessionToken(sessionCookie);

  const allowed = await hasCoursesAccess(sessionUser);
  if (!allowed) {
    notFound();
  }

  const courses = getAllCourses();

  return (
    <div className="space-y-8">
      {/* Grid of Courses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <Link key={course.slug} href={`/courses/${course.slug}`}>
            <div className="glass-card rounded-2xl p-6 h-full flex flex-col justify-between group">
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                  {course.title}
                </h2>

                {course.keywords && (
                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {course.keywords}
                  </p>
                )}
              </div>

              <div className="pt-6 mt-6 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>{course.sectionsCount} Sections</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <span>{course.unitsCount} Units</span>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-300 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
