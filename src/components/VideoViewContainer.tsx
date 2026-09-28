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
    <main
      role="main"
      className={`w-full flex flex-col min-h-0 h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] lg:h-[calc(100vh-5rem)] overflow-hidden ${isTheaterMode ? 'bg-black' : 'bg-transparent'}`}
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
          />
        </aside>
      </div>
    </main>
  );
}
