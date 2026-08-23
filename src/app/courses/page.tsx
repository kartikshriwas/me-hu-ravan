import Link from 'next/link';
import { getAllCourses } from '@/lib/coursesData';
import { BookOpen, Layers, Brain, ArrowRight, Lock, Unlock } from 'lucide-react';
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

  const allCourses = getAllCourses();

  const courses = await Promise.all(
    allCourses.map(async (course) => {
      const isUnlocked = await hasCoursesAccess(sessionUser, course.slug);
      return { ...course, isUnlocked };
    })
  );

  return (
    <div className="space-y-8">
      {/* Grid of Courses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <Link key={course.slug} href={`/courses/${course.slug}`}>
            <div className={`glass-card rounded-2xl p-6 h-full flex flex-col justify-between group transition-all relative overflow-hidden ${
              course.isUnlocked ? 'border-slate-800 hover:border-purple-500/50' : 'border-slate-800/60 opacity-85 hover:opacity-100'
            }`}>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                    {course.title}
                  </h2>
                  {course.isUnlocked ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 flex items-center gap-1">
                      <Unlock className="w-3 h-3 text-emerald-400" /> Unlocked
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-400" /> Batch Locked
                    </span>
                  )}
                </div>

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

                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  course.isUnlocked
                    ? 'bg-purple-600/20 text-purple-300 group-hover:bg-purple-600 group-hover:text-white'
                    : 'bg-slate-800 text-slate-500'
                }`}>
                  {course.isUnlocked ? <ArrowRight className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
