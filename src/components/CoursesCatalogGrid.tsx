'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers, Brain, ArrowRight, Lock, Unlock, PlayCircle } from 'lucide-react';
import { CourseMeta } from '@/lib/types';

export type CourseItem = CourseMeta & { isUnlocked: boolean };

interface LastVideoInfo {
  videoId: string;
  title?: string;
  timestamp?: number;
}

const formatTime = (seconds?: number) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export function CoursesCatalogGrid({ courses }: { courses: CourseItem[] }) {
  const [lastVideos, setLastVideos] = useState<Record<string, LastVideoInfo>>({});

  useEffect(() => {
    try {
      const map: Record<string, LastVideoInfo> = {};
      courses.forEach((course) => {
        const stored = localStorage.getItem(`preptea_last_video_${course.slug}`);
        if (stored) {
          map[course.slug] = JSON.parse(stored);
        }
      });
      setLastVideos(map);
    } catch (e) {
      // ignore
    }
  }, [courses]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {courses.map((course) => {
        const lastVideo = lastVideos[course.slug];

        return (
          <Link key={course.slug} href={`/courses/${course.slug}`}>
            <div
              className={`glass-card rounded-2xl p-6 h-full flex flex-col justify-between group transition-all relative overflow-hidden ${
                course.isUnlocked ? 'border-slate-800 hover:border-purple-500/50' : 'border-slate-800/60 opacity-85 hover:opacity-100'
              }`}
            >
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
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {course.keywords}
                  </p>
                )}

                {/* Last watched video indicator badge */}
                {lastVideo && course.isUnlocked && (
                  <div className="pt-1">
                    <span
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.location.href = `/courses/${course.slug}/video/${lastVideo.videoId}`;
                      }}
                      className="inline-flex max-w-full text-[11px] font-semibold text-indigo-300 bg-indigo-950/70 hover:bg-indigo-900/90 border border-indigo-500/40 hover:border-indigo-400 px-3 py-1.5 rounded-xl items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <PlayCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 animate-pulse" />
                      <span className="truncate">
                        Continue: {lastVideo.title || 'Video Lesson'} ({formatTime(lastVideo.timestamp)})
                      </span>
                    </span>
                  </div>
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

                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    course.isUnlocked
                      ? 'bg-purple-600/20 text-purple-300 group-hover:bg-purple-600 group-hover:text-white'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {course.isUnlocked ? <ArrowRight className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
