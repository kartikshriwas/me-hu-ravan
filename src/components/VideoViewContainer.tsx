'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RectangleHorizontal, Tv } from 'lucide-react';
import { CustomVideoPlayer } from '@/components/CustomVideoPlayer';
import { VideoPlaylistSidebar } from '@/components/VideoPlaylistSidebar';
import { CourseDetail } from '@/lib/types';

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
}: VideoViewContainerProps) {
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('preptea_theater_mode');
      if (stored === 'true') {
        setIsTheaterMode(true);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const toggleTheaterMode = () => {
    setIsTheaterMode((prev) => {
      const nextState = !prev;
      try {
        localStorage.setItem('preptea_theater_mode', String(nextState));
      } catch (e) {
        // ignore
      }
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

  return (
    <div className={`w-full flex flex-col min-h-0 ${isTheaterMode ? 'min-h-screen overflow-y-auto pb-12' : 'h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] lg:h-[calc(100vh-5rem)] overflow-hidden'}`}>
      {/* Desktop Navigation Header */}
      {/* <div className="hidden lg:flex items-center justify-between px-4 sm:px-6 py-2 shrink-0 bg-slate-950/40 border-b border-slate-800/60">
        <Link
          href={`/courses/${slug}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1 px-3 rounded-xl bg-slate-900/80 border border-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {course.title}</span>
        </Link>
      </div> */}

      {/* Main Layout Container */}
      <div
        className={`flex flex-col flex-1 min-h-0 ${
          isTheaterMode
            ? 'w-full space-y-6 pb-12'
            : 'lg:grid lg:grid-cols-12 lg:gap-4 xl:gap-6 lg:border-t lg:border-slate-800/60 px-2 sm:px-4 lg:px-6 py-2 sm:py-3'
        }`}
      >
        {/* Video Player Section (75% screen width on desktop) */}
        <div
          className={`${
            isTheaterMode
              ? 'w-full bg-slate-950 border-b border-slate-800/80 shadow-2xl'
              : 'lg:col-span-8 xl:col-span-9 flex flex-col shrink-0 min-w-0'
          }`}
        >
          {/* Mobile Back Button */}
          {/* <div className="lg:hidden flex items-center justify-between px-3 py-2 shrink-0 border-b border-slate-800/40">
            <Link
              href={`/courses/${slug}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{course.title}</span>
            </Link>
          </div> */}

          <div className={`${isTheaterMode ? 'max-w-7xl mx-auto w-full' : 'w-full'}`}>
            <CustomVideoPlayer
              videoId={videoId}
              courseSlug={slug}
              title={unitTitle}
              embedHtml={embedHtml}
              prevVideoUrl={prevVideoUrl || undefined}
              nextVideoUrl={nextVideoUrl || undefined}
              prevTitle={prevTitle || undefined}
              nextTitle={nextTitle || undefined}
              isTheaterMode={isTheaterMode}
              onToggleTheaterMode={toggleTheaterMode}
            />
          </div>
        </div>

        {/* Playlist Sidebar (25% screen width on desktop) */}
        <div
          className={`${
            isTheaterMode
              ? 'w-full max-w-5xl mx-auto px-4 sm:px-6'
              : 'flex-1 min-h-0 overflow-hidden lg:col-span-4 xl:col-span-3 min-w-0'
          }`}
        >
          <VideoPlaylistSidebar
            courseTitle={course.title}
            courseSlug={slug}
            currentVideoId={videoId}
            sections={course.sections}
          />
        </div>
      </div>
    </div>
  );
}
