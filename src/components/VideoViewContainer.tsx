'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, RectangleHorizontal, Tv } from 'lucide-react';
import { CustomVideoPlayer } from '@/components/CustomVideoPlayer';
import { CourseDetail } from '@/lib/types';
import {
  computeCourseCalendarDays,
  getCalendarVideoSequence,
  getCalendarVideoNavigation,
  getDefaultVideoSequence,
  getDefaultVideoNavigation,
  CalendarDayGroup,
} from '@/lib/courseCalendarHelper';
import { getQuizHistory } from '@/lib/storage';
import { useAuth } from '@/lib/authContext';

const VideoPlaylistSidebar = dynamic(
  () => import('@/components/VideoPlaylistSidebar').then((m) => m.VideoPlaylistSidebar),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[400px] rounded-2xl bg-card/40 border border-card-border/60 animate-pulse flex flex-col p-4 space-y-4">
        <div className="h-6 w-3/4 bg-slate-800 rounded-lg" />
        <div className="h-4 w-1/2 bg-slate-800/60 rounded" />
        <div className="space-y-2 pt-4">
          <div className="h-12 bg-slate-800/40 rounded-xl" />
          <div className="h-12 bg-slate-800/40 rounded-xl" />
          <div className="h-12 bg-slate-800/40 rounded-xl" />
        </div>
      </div>
    ),
  }
);

interface VideoViewContainerProps {
  course: CourseDetail;
  slug: string;
  videoId: string;
  unitTitle: string;
  embedHtml?: string;
  prevVideoUrl?: string;
  nextVideoUrl?: string;
  prevTitle?: string;
  nextTitle?: string;
  availableTests?: any[];
  initialMode?: 'default' | 'calendar';
}

export function VideoViewContainer({
  course,
  slug,
  videoId,
  unitTitle,
  embedHtml,
  prevVideoUrl,
  nextVideoUrl,
  prevTitle,
  nextTitle,
  availableTests = [],
  initialMode,
}: VideoViewContainerProps) {
  const { user } = useAuth();
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'default' | 'calendar'>(() => {
    if (initialMode === 'calendar' || initialMode === 'default') return initialMode;
    return 'default';
  });
  const [scheduleMode, setScheduleMode] = useState<'paced' | 'raw_batches'>('paced');
  const [completedVideos, setCompletedVideos] = useState<string[]>([]);
  const [quizHistory, setQuizHistory] = useState<any[]>([]);

  // Load preferences from localStorage & sync completed videos
  useEffect(() => {
    try {
      const storedTheater = localStorage.getItem('preptea_theater_mode');
      if (storedTheater === 'true') {
        setIsTheaterMode(true);
      }

      if (initialMode) {
        setViewMode(initialMode);
      } else {
        const storedMode = localStorage.getItem(`preptea_view_mode_${slug}`);
        if (storedMode === 'calendar' || storedMode === 'default') {
          setViewMode(storedMode);
        }
      }

      const storedSched = localStorage.getItem(`preptea_schedule_mode_${slug}`);
      if (storedSched === 'paced' || storedSched === 'raw_batches') {
        setScheduleMode(storedSched);
      }

      const syncCompleted = () => {
        try {
          const rawComp = localStorage.getItem('preptea_completed_videos');
          if (rawComp) setCompletedVideos(JSON.parse(rawComp));
          setQuizHistory(getQuizHistory(user?.email));
        } catch (e) {}
      };

      syncCompleted();
      window.addEventListener('storage', syncCompleted);
      window.addEventListener('focus', syncCompleted);
      return () => {
        window.removeEventListener('storage', syncCompleted);
        window.removeEventListener('focus', syncCompleted);
      };
    } catch (e) {
      // ignore
    }
  }, [slug, initialMode, user?.email]);

  const handleSetViewMode = (mode: 'default' | 'calendar') => {
    setViewMode(mode);
    try {
      localStorage.setItem(`preptea_view_mode_${slug}`, mode);
    } catch (e) {}
  };

  const handleSetScheduleMode = (mode: 'paced' | 'raw_batches') => {
    setScheduleMode(mode);
    try {
      localStorage.setItem(`preptea_schedule_mode_${slug}`, mode);
    } catch (e) {}
  };

  const toggleTheaterMode = () => {
    setIsTheaterMode((prev) => {
      const nextState = !prev;
      try {
        localStorage.setItem('preptea_theater_mode', String(nextState));
      } catch (e) {}
      return nextState;
    });
  };

  // Keyboard shortcut listener: 'T' or 't' for Theater mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputActive =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if (isInputActive) return;

      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        toggleTheaterMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute Calendar Days
  const calendarDays: CalendarDayGroup[] = useMemo(() => {
    return computeCourseCalendarDays({
      course,
      scheduleMode,
      availableTests,
      completedVideos,
      quizHistory,
    });
  }, [course, scheduleMode, availableTests, completedVideos, quizHistory]);

  // Compute Calendar sequence & navigation
  const calendarVideoSequence = useMemo(() => {
    return getCalendarVideoSequence(calendarDays, slug);
  }, [calendarDays, slug]);

  const calendarNav = useMemo(() => {
    return getCalendarVideoNavigation(calendarVideoSequence, videoId);
  }, [calendarVideoSequence, videoId]);

  // Compute Default sequence & navigation
  const defaultVideoSequence = useMemo(() => {
    return getDefaultVideoSequence(course.sections, slug);
  }, [course.sections, slug]);

  const defaultNav = useMemo(() => {
    return getDefaultVideoNavigation(defaultVideoSequence, videoId);
  }, [defaultVideoSequence, videoId]);

  // Effective navigation links based on active view mode
  const effectivePrevUrl =
    viewMode === 'calendar'
      ? calendarNav.prevVideo?.url || undefined
      : defaultNav.prevVideo?.url || prevVideoUrl || undefined;

  const effectiveNextUrl =
    viewMode === 'calendar'
      ? calendarNav.nextVideo?.url || undefined
      : defaultNav.nextVideo?.url || nextVideoUrl || undefined;

  const effectivePrevTitle =
    viewMode === 'calendar'
      ? calendarNav.prevVideo
        ? `Day ${calendarNav.prevVideo.dayNumber}: ${calendarNav.prevVideo.unitTitle}`
        : undefined
      : defaultNav.prevVideo?.unitTitle || prevTitle || undefined;

  const effectiveNextTitle =
    viewMode === 'calendar'
      ? calendarNav.nextVideo
        ? `Day ${calendarNav.nextVideo.dayNumber}: ${calendarNav.nextVideo.unitTitle}`
        : undefined
      : defaultNav.nextVideo?.unitTitle || nextTitle || undefined;

  // Find current section
  const currentSection = course.sections?.find((sec) =>
    sec.units?.some((u) => (u.sourceid || u.id) === videoId)
  );
  const currentSectionTitle = currentSection?.title || (currentSection as any)?.sectionTitle;
  const currentSectionId = currentSection?.id;

  return (
    <main
      role="main"
      className={`w-full flex flex-col min-h-0 h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] lg:h-[calc(100vh-4rem)] overflow-hidden ${
        isTheaterMode ? 'bg-black' : 'bg-transparent'
      }`}
    >
      {/* Main Layout Container */}
      <div
        className={`flex flex-col flex-1 min-h-0 lg:grid lg:grid-cols-12 transition-all duration-300 ${
          isTheaterMode
            ? 'lg:gap-0 px-0 py-0 bg-black'
            : 'lg:gap-4 xl:gap-6 lg:border-t lg:border-card-border/60 px-2 sm:px-4 lg:px-6 py-2 sm:py-3'
        }`}
      >
        {/* Video Player Section */}
        <section
          aria-label="Video Player"
          className={`flex flex-col shrink-0 min-w-0 ${
            isTheaterMode
              ? 'lg:col-span-9 xl:col-span-9 2xl:col-span-9 bg-black border-r border-card-border/40 shadow-2xl'
              : 'lg:col-span-8 xl:col-span-9'
          }`}
        >
          <div className="w-full h-full flex flex-col">
            <CustomVideoPlayer
              videoId={videoId}
              courseSlug={slug}
              courseTitle={course.title}
              sectionTitle={
                viewMode === 'calendar' && calendarNav.currentVideo
                  ? `Day ${calendarNav.currentVideo.dayNumber}: ${calendarNav.currentVideo.targetTitle}`
                  : currentSectionTitle
              }
              sectionId={currentSectionId}
              title={unitTitle}
              embedHtml={embedHtml}
              prevVideoUrl={effectivePrevUrl}
              nextVideoUrl={effectiveNextUrl}
              prevTitle={effectivePrevTitle}
              nextTitle={effectiveNextTitle}
              isTheaterMode={isTheaterMode}
              onToggleTheaterMode={toggleTheaterMode}
            />
          </div>
        </section>

        {/* Playlist Sidebar */}
        <aside
          aria-label="Course Curriculum Playlist"
          className={`flex-1 min-h-0 overflow-hidden min-w-0 ${
            isTheaterMode
              ? 'lg:col-span-3 xl:col-span-3 2xl:col-span-3 bg-background/80'
              : 'lg:col-span-4 xl:col-span-3'
          }`}
        >
          <VideoPlaylistSidebar
            courseTitle={course.title}
            courseSlug={slug}
            currentVideoId={videoId}
            sections={course.sections}
            calendarDays={calendarDays}
            viewMode={viewMode}
            onToggleViewMode={handleSetViewMode}
            scheduleMode={scheduleMode}
            onToggleScheduleMode={handleSetScheduleMode}
            availableTests={availableTests}
          />
        </aside>
      </div>
    </main>
  );
}
