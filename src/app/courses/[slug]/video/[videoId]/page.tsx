import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCourseBySlug } from '@/lib/coursesData';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { hasCoursesAccess, isCourseSlugUnlocked, checkIsDemoExpired } from '@/lib/coursesAuth';
import { CustomVideoPlayer } from '@/components/CustomVideoPlayer';
import { VideoPlaylistSidebar } from '@/components/VideoPlaylistSidebar';
import { ArrowLeft, Lock, VideoOff } from 'lucide-react';
import { getAllAssessments } from '@/lib/questionsData';
import { CourseSectionUnit } from '@/lib/types';

import { VideoViewContainer } from '@/components/VideoViewContainer';


interface PageProps {
  params: Promise<{
    slug: string;
    videoId: string;
  }>;
  searchParams?: Promise<{
    mode?: string;
  }>;
}

export default async function VideoPlayerPage({ params, searchParams }: PageProps) {
  const { slug, videoId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialMode =
    resolvedSearchParams?.mode === 'calendar'
      ? 'calendar'
      : resolvedSearchParams?.mode === 'default'
      ? 'default'
      : undefined;

  // 1. Session verification & Course catalog access check
  const session = await auth();
  const sessionUser = session?.user as any;

  const allowed = await hasCoursesAccess(sessionUser);
  if (!allowed) {
    const demoStatus = checkIsDemoExpired(sessionUser);
    if (demoStatus.isExpired) {
      redirect(`/?demo_expired=true&mins=${demoStatus.minutes}`);
    }
    notFound();
  }

  // 2. Load course details
  const course = getCourseBySlug(slug);
  if (!course) {
    notFound();
  }

  // 3. Verify if video playback for this batch is unlocked
  const isUnlocked = await isCourseSlugUnlocked(sessionUser, slug);
  if (!isUnlocked) {
    const demoStatus = checkIsDemoExpired(sessionUser);
    if (demoStatus.isExpired) {
      redirect(`/?demo_expired=true&mins=${demoStatus.minutes}`);
    }
    return (
      <div className="max-w-3xl mx-auto space-y-6 py-12 px-4 text-center">
        <div className="glass-panel rounded-3xl p-8 sm:p-12 border border-amber-500/30 space-y-6 bg-amber-950/20 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Video Playback Locked</h2>
            <p className="text-xs text-amber-600 dark:text-amber-300/90 max-w-md mx-auto leading-relaxed">
              You do not have access to play videos in the <span className="font-bold text-foreground">{course.title}</span> batch. Contact your platform administrator or activate a redeem code for this batch to unlock video playback.
            </p>
          </div>
          <div>
            <Link
              href={`/courses/${slug}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Course Syllabus</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Find all playable video units in curriculum order (both ivideo and youtube)
  const allVideoUnits = course.sections.flatMap(section => 
    section.units.filter(unit => {
      const t = (unit.objectType || unit.type || '').toLowerCase();
      return t === 'ivideo' || t === 'youtube' || !!unit.sourceid || (unit.data && !!unit.data.embed);
    })
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
  const isYouTubeUnit = (currentUnit?.objectType || currentUnit?.type || '').toLowerCase() === 'youtube' || !!embedHtml;
  const hasVideoSource = !!(currentUnit?.sourceid && currentUnit.sourceid.trim() !== '') || isYouTubeUnit;

  if (currentUnit && !hasVideoSource) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 py-12 px-4 text-center">
        <div className="glass-panel rounded-3xl p-8 sm:p-12 border border-card-border space-y-6 bg-card/60 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-slate-800 text-muted-foreground flex items-center justify-center mx-auto border border-slate-700/60">
            <VideoOff className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Video Not Available</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              The video source for <span className="font-bold text-foreground">{unitTitle}</span> is currently not available.
            </p>
          </div>
          <div>
            <Link
              href={`/courses/${slug}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-foreground font-bold text-xs shadow-lg transition-all border border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Course Syllabus</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  const availableTests = getAllAssessments();

  return (
    <VideoViewContainer
      course={course}
      slug={slug}
      videoId={videoId}
      unitTitle={unitTitle}
      embedHtml={embedHtml}
      prevVideoUrl={prevVideoUrl || undefined}
      nextVideoUrl={nextVideoUrl || undefined}
      prevTitle={prevTitle || undefined}
      nextTitle={nextTitle || undefined}
      availableTests={availableTests}
      initialMode={initialMode}
    />
  );
}
