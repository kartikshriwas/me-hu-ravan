import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCourseBySlug } from '@/lib/coursesData';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/session';
import { hasCoursesAccess } from '@/lib/coursesAuth';
import { CustomVideoPlayer } from '@/components/CustomVideoPlayer';
import { ArrowLeft } from 'lucide-react';
import { CourseSectionUnit } from '@/lib/types';

export const revalidate = 0;

interface PageProps {
  params: Promise<{
    slug: string;
    videoId: string;
  }>;
}

export default async function VideoPlayerPage({ params }: PageProps) {
  const { slug, videoId } = await params;

  // 1. Session verification & Course catalog access check
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('preptea_session')?.value;
  const sessionUser = verifySessionToken(sessionCookie);

  const allowed = await hasCoursesAccess(sessionUser, slug);
  if (!allowed) {
    notFound();
  }

  // 2. Load course details to find matching unit title
  const course = getCourseBySlug(slug);
  if (!course) {
    notFound();
  }

  // Find all playable video units in curriculum order (both Wistia sourceid and YouTube embed units)
  const allVideoUnits = course.sections.flatMap(section => 
    section.units.filter(unit => !!unit.sourceid || unit.type === 'youtube' || (unit.data && !!unit.data.embed))
  );

  const currentIdx = allVideoUnits.findIndex(u => (u.sourceid && u.sourceid === videoId) || u.id === videoId);
  
  let prevVideoUrl: string | null = null;
  let nextVideoUrl: string | null = null;
  let prevTitle: string | null = null;
  let nextTitle: string | null = null;

  if (currentIdx !== -1) {
    if (currentIdx > 0) {
      const prevUnit = allVideoUnits[currentIdx - 1];
      const prevId = prevUnit.sourceid || prevUnit.id;
      prevVideoUrl = `/courses/${slug}/video/${prevId}`;
      prevTitle = prevUnit.unitTitle || prevUnit.title || 'Previous Video';
    }
    if (currentIdx < allVideoUnits.length - 1) {
      const nextUnit = allVideoUnits[currentIdx + 1];
      const nextId = nextUnit.sourceid || nextUnit.id;
      nextVideoUrl = `/courses/${slug}/video/${nextId}`;
      nextTitle = nextUnit.unitTitle || nextUnit.title || 'Next Video';
    }
  }

  // Find the unit with matching sourceid or id
  let currentUnit: CourseSectionUnit | null = null;
  let unitTitle = 'Video Lesson';

  for (const section of course.sections) {
    const found = section.units.find((u) => (u.sourceid && u.sourceid === videoId) || u.id === videoId);
    if (found) {
      currentUnit = found;
      unitTitle = found.unitTitle || found.title || 'Video Lesson';
      break;
    }
  }

  const embedHtml = currentUnit?.data?.embed;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4 px-2 sm:px-6">
      {/* Back Button */}
      <Link
        href={`/courses/${slug}`}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to {course.title}</span>
      </Link>

      {/* Cinematic Custom Video Player Container */}
      <div className="glass-panel rounded-3xl p-4 sm:p-6 border border-indigo-500/20 shadow-2xl bg-slate-900/90">
        <CustomVideoPlayer
          videoId={videoId}
          title={unitTitle}
          embedHtml={embedHtml}
          prevVideoUrl={prevVideoUrl || undefined}
          nextVideoUrl={nextVideoUrl || undefined}
          prevTitle={prevTitle || undefined}
          nextTitle={nextTitle || undefined}
        />
      </div>
    </div>
  );
}
