'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Layers, Brain, Lock, Unlock, PlayCircle, Clock, Sparkles, LayoutGrid, Library, BookOpen, Search } from 'lucide-react';
import { CourseMeta } from '@/lib/types';

export type CourseItem = CourseMeta & { isUnlocked: boolean };

const RECOMMENDED_SLUGS = [
  'alpha-plus-7-java',
  'alpha-plus-7-cpp',
  'delta-5',
  'prime-ai',
  'aptitude-hinglish',
  'ai-projects-module',
  'delta-library',
  'plus-library'
];

// Definition for Section X (Featured 6-7 courses with custom names and descriptions)
const FEATURED_COURSES_CONFIG: {
  slug: string;
  customTitle: string;
  customDescription?: string;
}[] = [
  {
    slug: 'alpha-plus-7-cpp',
    customTitle: 'DSA - CPP',
  },
  {
    slug: 'alpha-plus-7-java',
    customTitle: 'DSA - JAVA',
  },
  {
    slug: 'delta-5',
    customTitle: 'MERN-Stack/Full stack web dev',
  },
  {
    slug: 'prime-ai',
    customTitle: 'AI/ML batch',
  },
  {
    slug: 'aptitude-hinglish',
    customTitle: 'Aptitude Batch (Hinglish)',
    customDescription: 'Complete Quantitative Aptitude, Logical Reasoning & Verbal Ability preparation in Hinglish.',
  },
  {
    slug: 'aptitude-english',
    customTitle: 'Aptitude Batch (English)',
    customDescription: 'Complete Quantitative Aptitude, Logical Reasoning & Verbal Ability preparation in English.',
  },
  {
    slug: 'plus-library',
    customTitle: 'Plus Library',
    customDescription: 'This Library is a collection of Previous Year Questions asked by companies like Google, Microsoft, Amazon, Atlassian',
  },
  {
    slug: 'delta-library',
    customTitle: 'DevHub Library',
    customDescription: 'This is the Library of Projects & Advance Dev Modules for Full Stack Web Development.',
  },
  {
    slug: 'ai-projects-module',
    customTitle: 'AI Projects Module',
    customDescription: 'This module contains the AI Major projects of the AI/ML Batch.',
  },
];

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

const formatCourseDuration = (seconds?: number): string | null => {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m} min`;
};

// Helper to determine batch category for Section Y subcategory filter
const getCategoryForCourse = (course: CourseItem): 'Alpha' | 'Delta' | 'Prime' | 'Sigma' | 'Other' => {
  const slug = course.slug.toLowerCase();
  const title = course.title.toLowerCase();

  if (slug.includes('alpha') || title.includes('alpha')) return 'Alpha';
  if (slug.includes('delta') || title.includes('delta') || slug === 'dev') return 'Delta';
  if (slug.includes('sigma') || title.includes('sigma') || slug === 'cpp' || slug === 'java' || slug === 'live') return 'Sigma';
  if (slug.includes('prime') || title.includes('prime') || slug.includes('ai')) return 'Prime';

  return 'Other';
};

export function CoursesCatalogGrid({ courses }: { courses: CourseItem[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<'x' | 'y'>('x');
  const [selectedSubCategory, setSelectedSubCategory] = useState<'All' | 'Alpha' | 'Delta' | 'Prime' | 'Sigma'>('All');
  const [lastVideos, setLastVideos] = useState<Record<string, LastVideoInfo>>({});
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: Ctrl + F, Cmd + F, Shift + F, or '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputActive = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;

      const isCtrlF = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f';
      const isShiftF = e.shiftKey && e.key.toLowerCase() === 'f';
      const isSlash = e.key === '/' && !isInputActive;

      if (isCtrlF || isShiftF || isSlash) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Section X Courses: Filtered and mapped with custom titles and descriptions
  const sectionXCourses = useMemo(() => {
    return FEATURED_COURSES_CONFIG.map((config) => {
      const found = courses.find((c) => c.slug.toLowerCase() === config.slug.toLowerCase());
      if (!found) return null;
      return {
        ...found,
        displayTitle: config.customTitle,
        displayDescription: config.customDescription || found.keywords || found.description || '',
      };
    }).filter(Boolean) as (CourseItem & { displayTitle: string; displayDescription: string })[];
  }, [courses]);

  // Section Y Courses: Filtered by subcategory
  const sectionYCourses = useMemo(() => {
    if (selectedSubCategory === 'All') return courses;
    return courses.filter((c) => getCategoryForCourse(c) === selectedSubCategory);
  }, [courses, selectedSubCategory]);

  // Smart multi-word search helper with precise number matching and alias expansion
  const matchCourseSmart = (title: string, description: string, slug: string, keywords: string, rawQuery: string) => {
    const q = rawQuery.toLowerCase().trim();
    if (!q) return true;

    const fullText = `${title} ${description} ${slug} ${keywords}`.toLowerCase();

    // 1. Direct substring match
    if (fullText.includes(q)) return true;

    const tokens = q.split(/\s+/).filter(Boolean);

    // 2. Strict version number check (e.g. "6", "5", "8", "11")
    const numberTokens = tokens.filter((t) => /^\d+(\.\d+)?$/.test(t));
    if (numberTokens.length > 0) {
      const hasAllNumbers = numberTokens.every((num) => {
        const regex = new RegExp(`\\b${num}(\\.0)?\\b|${num}`, 'i');
        return regex.test(fullText);
      });
      if (!hasAllNumbers) return false;
    }

    // 3. Text tokens check
    const textTokens = tokens.filter((t) => !/^\d+(\.\d+)?$/.test(t));
    if (textTokens.length === 0) return true;

    return textTokens.every((token) => {
      if (fullText.includes(token)) return true;
      if (token === 'dsa' && (fullText.includes('alpha') || fullText.includes('sigma') || fullText.includes('cpp') || fullText.includes('java') || fullText.includes('dsa'))) return true;
      if ((token === 'web' || token === 'dev') && (fullText.includes('delta') || fullText.includes('mern') || fullText.includes('stack'))) return true;
      if ((token === 'ai' || token === 'ml') && (fullText.includes('prime') || fullText.includes('ai') || fullText.includes('ml'))) return true;
      if (token === 'apti' && (fullText.includes('aptitude') || fullText.includes('hinglish') || fullText.includes('english'))) return true;
      return false;
    });
  };

  // Search Filtering
  const filteredSectionXCourses = useMemo(() => {
    if (!searchQuery) return sectionXCourses;
    return sectionXCourses.filter((c) =>
      matchCourseSmart(c.displayTitle, c.displayDescription, c.slug, c.keywords || '', searchQuery)
    );
  }, [sectionXCourses, searchQuery]);

  const filteredSectionYCourses = useMemo(() => {
    let list = sectionYCourses;
    if (!searchQuery) return list;
    return list.filter((c) =>
      matchCourseSmart(c.title, c.description || '', c.slug, c.keywords || '', searchQuery)
    );
  }, [sectionYCourses, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Main Navigation Bar (Section X vs Section Y) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-4">
        <div className="flex items-center gap-2 p-1.5 bg-slate-900/80 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveSection('x')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeSection === 'x'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Featured Courses</span>
          </button>
          <button
            onClick={() => setActiveSection('y')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeSection === 'y'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>All Courses & Batches</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search courses, topics, or languages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-16 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all shadow-inner"
          />

        </div>

        {/* Section Y Subcategory Navbar Filter (Alpha, Delta, Prime, Sigma) */}
        {activeSection === 'y' && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800/80 overflow-x-auto custom-scrollbar max-w-full">
            {(['All', 'Alpha', 'Delta', 'Prime', 'Sigma'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedSubCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  selectedSubCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid Display */}
      {activeSection === 'x' ? (
        // SECTION X: Featured Courses Grid
        filteredSectionXCourses.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3 glass-panel rounded-2xl border border-slate-800">
            <Search className="w-8 h-8 text-purple-400 mx-auto opacity-70" />
            <p className="text-base font-bold text-slate-200">No courses found matching "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-bold border border-purple-500/30 transition-all"
            >
              Clear Search Query
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-6">
            {filteredSectionXCourses.map((course) => {
            const lastVideo = lastVideos[course.slug];

            return (
              <Link key={course.slug} href={`/courses/${course.slug}`}>
                <div
                  className={`glass-card rounded-2xl p-6 h-full flex flex-col justify-between group transition-all relative overflow-hidden ${
                    course.isUnlocked ? 'border-slate-800 hover:border-purple-500/50' : 'border-slate-800/80 grayscale opacity-60 hover:grayscale-0 hover:opacity-100'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="space-y-1 min-w-0 flex-1">
                        <h2 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors inline-flex items-center gap-2">
                          <span>{course.displayTitle}</span>
                          {course.isOngoing && (
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shrink-0" title="Ongoing Course" />
                          )}
                        </h2>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed font-medium">
                      {course.displayDescription}
                    </p>

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
                      {formatCourseDuration(course.totalDurationSeconds) && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-purple-400" />
                          <span>{formatCourseDuration(course.totalDurationSeconds)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
          </div>
        )
      ) : (
        // SECTION Y: All Courses & Batches Grid (Filtered by Subcategory & Search)
        filteredSectionYCourses.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3 glass-panel rounded-2xl border border-slate-800">
            <Search className="w-8 h-8 text-purple-400 mx-auto opacity-70" />
            <p className="text-base font-bold text-slate-200">No courses found matching "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-bold border border-purple-500/30 transition-all"
            >
              Clear Search Query
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-6">
              {filteredSectionYCourses.map((course) => {
              const lastVideo = lastVideos[course.slug];

              return (
                <Link key={course.slug} href={`/courses/${course.slug}`}>
                  <div
                    className={`glass-card rounded-2xl p-6 h-full flex flex-col justify-between group transition-all relative overflow-hidden ${
                      course.isUnlocked ? 'border-slate-800 hover:border-purple-500/50' : 'border-slate-800/80 grayscale opacity-60 hover:grayscale-0 hover:opacity-100'
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <h2 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors inline-flex items-center gap-2 flex-wrap">
                            <span>{course.title}</span>
                            {course.isOngoing && (
                              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shrink-0" title="Ongoing Course" />
                            )}
                          </h2>
                          {RECOMMENDED_SLUGS.includes(course.slug) && (
                            <div className="pt-0.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                <Sparkles className="w-3 h-3 text-purple-400" /> Recommended
                              </span>
                            </div>
                          )}
                        </div>
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
                        {formatCourseDuration(course.totalDurationSeconds) && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-purple-400" />
                            <span>{formatCourseDuration(course.totalDurationSeconds)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
        )
      )}
    </div>
  );
}

