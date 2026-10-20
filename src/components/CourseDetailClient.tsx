'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { CourseDetail, CourseSectionUnit } from '@/lib/types';
import { AssessmentMeta } from '@/lib/types';
import {
  Search,
  X,
  BookOpen,
  Layers,
  Video,
  FileCheck2,
  FileText,
  Award,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Play,
  PlayCircle,
  HelpCircle,
  FileEdit,
  Paperclip,
  UserCheck,
  Package,
  Music,
  Headphones,
  Code,
  Presentation,
  ExternalLink,
  Tv,
  Users,
  User,
  ClipboardList,
  Link2,
  Download,
  Lock,
  VideoOff,
  Clock,
  CheckCircle2,
  ArrowDownToLine,
  Loader2,
  Trash2,
  Sparkles,
  CalendarDays,
  Flame,
  Pause,
  Settings,
  RotateCcw,
} from 'lucide-react';
import { useDownloads } from '@/lib/downloadContext';
import { useAuth } from '@/lib/authContext';
import { checkCanDownload } from '@/lib/batchAccess';
import { DownloadLessonModal, SingleLessonDownloadTarget } from '@/components/DownloadLessonModal';
import { getRememberedQuality, saveRememberedQuality } from '@/lib/qualityMatcher';
import { CourseCalendarView } from '@/components/CourseCalendarView';
import { recordVideoCompletionToDb, syncLocalProgressToDb, fetchUserProgressFromDb } from '@/lib/userProgressClient';

interface CourseDetailClientProps {
  course: CourseDetail;
  availableTests: AssessmentMeta[];
  isUnlocked?: boolean;
}

function formatCourseDuration(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m} min`;
}

function formatUnitDuration(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Returns metadata config (Icon, Color, Label, Category) for all 33 learning_path_type variants
 */
function getUnitMetaConfig(unit: CourseSectionUnit) {
  const type = (unit.objectType || unit.type || '').toLowerCase();

  // 1. YouTube Video
  if (type === 'youtube') {
    return {
      category: 'video',
      typeLabel: 'YouTube Video',
      icon: PlayCircle,
      colorClass: 'bg-red-600/20 text-red-600 dark:text-red-400 border-red-500/30',
      isActionableVideo: true,
      isActionableExam: false,
    };
  }

  // 2. Video Lesson (ivideo)
  if (type === 'ivideo' || type === 'video' || type === 'wistia') {
    return {
      category: 'video',
      typeLabel: 'Video Lesson',
      icon: Video,
      colorClass: 'bg-blue-600/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
      isActionableVideo: true,
      isActionableExam: false,
    };
  }

  // 3. Exams & Quizzes (assessmentV2)
  if (type === 'assessmentv2' || type === 'assessment' || type === 'quiz') {
    return {
      category: 'quiz',
      typeLabel: 'Assessment & Quiz',
      icon: FileCheck2,
      colorClass: 'bg-primary-600/20 text-primary-600 dark:text-primary-400 border-primary-500/30',
      isActionableVideo: false,
      isActionableExam: true,
    };
  }

  // 4. Downloadable Files / eBooks (pbEbook)
  if (type === 'pbebook' || type === 'ebook') {
    return {
      category: 'ebook',
      typeLabel: 'Downloadable File',
      icon: BookOpen,
      colorClass: 'bg-teal-600/20 text-teal-600 dark:text-teal-400 border-teal-500/30',
      isActionableVideo: false,
      isActionableExam: false,
    };
  }

  // Fallback
  return {
    category: 'other',
    typeLabel: unit.subtitle || unit.type || 'Resource',
    icon: FileText,
    colorClass: 'bg-slate-800 text-muted-foreground border-slate-700/50',
    isActionableVideo: false,
    isActionableExam: false,
  };
}

export function CourseDetailClient({ course, availableTests, isUnlocked = true }: CourseDetailClientProps) {
  const {
    isDownloaded,
    isDownloading,
    isQueued,
    isPaused,
    isFailed,
    retryDownload,
    getDownloadProgress,
    startDownload,
    downloadSection,
    downloadCourse,
    isCourseDownloaded,
    isCourseDownloading,
    getCourseDownloadedCount,
    isSectionDownloaded,
    isSectionDownloading,
    getSectionDownloadedCount,
    deleteCourseDownloads,
    deleteSectionDownloads,
    deleteDownload,
    pauseDownload,
    resumeDownload,
    batchProgress,
    cancelBatchDownload,
  } = useDownloads();

  const { user } = useAuth();
  const canDownload = checkCanDownload(user);

  const [lastVideoInfo, setLastVideoInfo] = useState<{ videoId: string; title?: string; timestamp?: number } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'default' | 'calendar'>('default');
  const [completedVideos, setCompletedVideos] = useState<string[]>([]);

  // Load preferred view mode and sync completed videos
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(`preptea_view_mode_${course.slug}`);
      if (savedMode === 'calendar' || savedMode === 'default') {
        setViewMode(savedMode);
      }
    } catch (e) {}

    const syncCompleted = () => {
      try {
        const savedCompleted = localStorage.getItem('preptea_completed_videos');
        const nextList: string[] = savedCompleted ? JSON.parse(savedCompleted) : [];
        setCompletedVideos((prev) => {
          if (
            prev.length === nextList.length &&
            prev.every((val, idx) => val === nextList[idx])
          ) {
            return prev;
          }
          return nextList;
        });
      } catch (e) {}
    };

    syncCompleted();
    syncLocalProgressToDb();
    window.addEventListener('storage', syncCompleted);
    window.addEventListener('focus', syncCompleted);
    window.addEventListener('preptea_study_update', syncCompleted);

    return () => {
      window.removeEventListener('storage', syncCompleted);
      window.removeEventListener('focus', syncCompleted);
      window.removeEventListener('preptea_study_update', syncCompleted);
    };
  }, [course.slug]);

  const handleSetViewMode = (mode: 'default' | 'calendar') => {
    setViewMode(mode);
    try {
      localStorage.setItem(`preptea_view_mode_${course.slug}`, mode);
    } catch (e) {}
  };

  const handleToggleComplete = (videoId: string) => {
    if (!videoId) return;
    setCompletedVideos((prev) => {
      const exists = prev.includes(videoId);
      const updated = exists ? prev.filter((id) => id !== videoId) : [...prev, videoId];
      try {
        localStorage.setItem('preptea_completed_videos', JSON.stringify(updated));

        // If completing a video, log today to studyDays for streak
        if (!exists) {
          const todayStr = new Date().toISOString().split('T')[0];
          const raw = localStorage.getItem('preptea_learning_streak_data');
          let studyDays: string[] = [];
          if (raw) {
            try {
              studyDays = JSON.parse(raw).studyDays || [];
            } catch (err) {}
          }
          if (!studyDays.includes(todayStr)) {
            studyDays.push(todayStr);
            localStorage.setItem(
              'preptea_learning_streak_data',
              JSON.stringify({ studyDays, lastUpdated: Date.now() })
            );
          }
        }
      } catch (e) {}

      if (!exists) {
        recordVideoCompletionToDb(videoId, course.slug);
      }

      return updated;
    });
  };

  const handleBatchToggleComplete = (videoIds: string[], markComplete: boolean) => {
    if (!videoIds || videoIds.length === 0) return;
    setCompletedVideos((prev) => {
      let updated: string[];
      if (markComplete) {
        const set = new Set([...prev, ...videoIds]);
        updated = Array.from(set);

        const todayStr = new Date().toISOString().split('T')[0];
        const raw = localStorage.getItem('preptea_learning_streak_data');
        let studyDays: string[] = [];
        if (raw) {
          try {
            studyDays = JSON.parse(raw).studyDays || [];
          } catch (err) {}
        }
        if (!studyDays.includes(todayStr)) {
          studyDays.push(todayStr);
          try {
            localStorage.setItem(
              'preptea_learning_streak_data',
              JSON.stringify({ studyDays, lastUpdated: Date.now() })
            );
          } catch (e) {}
        }
      } else {
        const removeSet = new Set(videoIds);
        updated = prev.filter((id) => !removeSet.has(id));
      }

      try {
        localStorage.setItem('preptea_completed_videos', JSON.stringify(updated));
      } catch (e) {}

      if (markComplete) {
        syncLocalProgressToDb(true);
      }

      return updated;
    });
  };
  const [bundleQualityModal, setBundleQualityModal] = useState<{
    type: 'course' | 'section';
    title: string;
    totalVideos: number;
    section?: { title: string; id: string; units: CourseSectionUnit[] };
  } | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string>('720p');
  const [rememberPreference, setRememberPreference] = useState<boolean>(false);

  useEffect(() => {
    setSelectedQuality(getRememberedQuality('720p'));
    if (typeof window !== 'undefined') {
      setRememberPreference(localStorage.getItem('preptea_remember_download_quality') === 'true');
    }
  }, []);

  const [singleDownloadModal, setSingleDownloadModal] = useState<SingleLessonDownloadTarget | null>(null);

  // Downloadable video units in the entire course
  const courseVideoUnits = useMemo(() => {
    const list: {
      videoId: string;
      unitTitle: string;
      sectionTitle: string;
      sectionId: string;
      duration?: number;
    }[] = [];

    course.sections.forEach((sec) => {
      sec.units.forEach((u, uIdx) => {
        const t = (u.objectType || u.type || '').toLowerCase();
        const sid = (u.sourceid || u.vimeoid || '').trim();
        // Only ivideo is downloadable offline (YouTube streams online)
        if (t === 'ivideo' && sid) {
          list.push({
            videoId: sid,
            unitTitle: (u.unitTitle && u.unitTitle !== 'Untitled') ? u.unitTitle : `${sec.title} Lesson ${uIdx + 1}`,
            sectionTitle: sec.title,
            sectionId: sec.id,
            duration: u.duration,
          });
        }
      });
    });

    return list;
  }, [course]);

  const totalCourseVideos = courseVideoUnits.length;
  const courseDownloadedCount = getCourseDownloadedCount(course.slug);
  const isCourseFullyDownloaded =
    totalCourseVideos > 0 && isCourseDownloaded(course.slug, totalCourseVideos);
  const isCourseActiveDownloading = isCourseDownloading(course.slug);

  const getSectionVideoUnits = React.useCallback(
    (section: { title: string; id: string; units: CourseSectionUnit[] }) => {
      const list: { videoId: string; unitTitle: string; duration?: number }[] = [];
      section.units.forEach((u, uIdx) => {
        const t = (u.objectType || u.type || '').toLowerCase();
        const sid = (u.sourceid || u.vimeoid || '').trim();
        if (t === 'ivideo' && sid) {
          list.push({
            videoId: sid,
            unitTitle: (u.unitTitle && u.unitTitle !== 'Untitled') ? u.unitTitle : `${section.title} Lesson ${uIdx + 1}`,
            duration: u.duration,
          });
        }
      });
      return list;
    },
    []
  );

  // Batch total duration in seconds for currently opened bundleQualityModal
  const modalBatchSecs = useMemo(() => {
    if (!bundleQualityModal) return 0;
    if (bundleQualityModal.type === 'course') {
      return courseVideoUnits.reduce((acc, u) => acc + (u.duration || 0), 0);
    }
    if (bundleQualityModal.section) {
      return getSectionVideoUnits(bundleQualityModal.section).reduce((acc, u) => acc + (u.duration || 0), 0);
    }
    return 0;
  }, [bundleQualityModal, courseVideoUnits, getSectionVideoUnits]);

  const formatBatchEstimatedSize = (quality: string) => {
    if (!bundleQualityModal) return '';
    const kbpsMap: Record<string, number> = {
      '1080p': 924,
      '720p': 552,
      '540p': 393,
      '360p': 267,
    };
    const kbps = kbpsMap[quality] || 552;
    const numVideos = bundleQualityModal.totalVideos || 1;

    if (modalBatchSecs > 0) {
      const totalBytes = modalBatchSecs * (kbps * 1000 / 8);
      const totalMb = totalBytes / (1024 * 1024);
      const avgMb = totalMb / numVideos;

      if (numVideos === 1) {
        return totalMb >= 1024 ? `~${(totalMb / 1024).toFixed(1)} GB` : `~${totalMb.toFixed(1)} MB`;
      }

      const totalStr = totalMb >= 1024 ? `${(totalMb / 1024).toFixed(1)} GB` : `${Math.round(totalMb)} MB`;
      const avgStr = avgMb >= 1024 ? `${(avgMb / 1024).toFixed(1)} GB/lesson` : `${Math.round(avgMb)} MB/lesson`;
      return `${totalStr} • ~${avgStr}`;
    }

    const fallbackSecs = numVideos * 600;
    const totalBytes = fallbackSecs * (kbps * 1000 / 8);
    const totalMb = totalBytes / (1024 * 1024);
    const avgMb = totalMb / numVideos;
    if (numVideos === 1) {
      return `~${Math.round(totalMb)} MB`;
    }
    return `${totalMb >= 1024 ? (totalMb / 1024).toFixed(1) + ' GB' : Math.round(totalMb) + ' MB'} • ~${Math.round(avgMb)} MB/lesson`;
  };

  const handleDownloadCourse = async () => {
    if (!canDownload) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('preptea:premium-download-required'));
      }
      return;
    }
    if (!isUnlocked) return;
    const rem = typeof window !== 'undefined' && localStorage.getItem('preptea_remember_download_quality') === 'true';
    if (rem) {
      const pref = getRememberedQuality('720p');
      const sectionsPayload = course.sections.map((sec) => ({
        sectionTitle: sec.title,
        sectionId: sec.id,
        units: getSectionVideoUnits(sec),
      }));
      await downloadCourse({
        courseSlug: course.slug,
        courseTitle: course.title,
        preferredQuality: pref,
        sections: sectionsPayload,
      });
      return;
    }
    setSelectedQuality(getRememberedQuality('720p'));
    setBundleQualityModal({
      type: 'course',
      title: course.title,
      totalVideos: totalCourseVideos,
    });
  };

  const handleDownloadSection = async (
    e: React.MouseEvent,
    section: { title: string; id: string; units: CourseSectionUnit[] }
  ) => {
    e.stopPropagation();
    if (!canDownload) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('preptea:premium-download-required'));
      }
      return;
    }
    if (!isUnlocked) return;
    const units = getSectionVideoUnits(section);
    const rem = typeof window !== 'undefined' && localStorage.getItem('preptea_remember_download_quality') === 'true';
    if (rem) {
      const pref = getRememberedQuality('720p');
      await downloadSection({
        courseSlug: course.slug,
        courseTitle: course.title,
        sectionTitle: section.title,
        sectionId: section.id,
        preferredQuality: pref,
        units,
      });
      return;
    }
    setSelectedQuality(getRememberedQuality('720p'));
    setBundleQualityModal({
      type: 'section',
      title: section.title,
      totalVideos: units.length,
      section,
    });
  };

  const handleDownloadUnit = (
    e: React.MouseEvent,
    unit: CourseSectionUnit,
    sectionTitle: string,
    sectionId: string
  ) => {
    e.stopPropagation();
    if (!canDownload) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('preptea:premium-download-required'));
      }
      return;
    }
    if (!isUnlocked) return;
    const videoId = (unit.sourceid || unit.vimeoid || '').trim();
    if (!videoId) return;

    if (typeof window !== 'undefined' && localStorage.getItem('preptea_remember_download_quality') === 'true') {
      const prefQuality = localStorage.getItem('preptea_preferred_quality') || '720';
      const cleanQuality = `${prefQuality.replace(/\D/g, '') || '720'}p`;
      startDownload({
        videoId,
        courseSlug: course.slug,
        courseTitle: course.title,
        sectionTitle,
        sectionId,
        unitTitle: (unit.unitTitle && unit.unitTitle !== 'Untitled') ? unit.unitTitle : 'Video Lesson',
        thumbnailUrl: '',
        durationSeconds: unit.duration || 0,
        quality: cleanQuality,
      });
      return;
    }

    setSingleDownloadModal({
      videoId,
      courseSlug: course.slug,
      courseTitle: course.title,
      sectionTitle,
      sectionId,
      unitTitle: (unit.unitTitle && unit.unitTitle !== 'Untitled') ? unit.unitTitle : 'Video Lesson',
      thumbnailUrl: '',
      durationSeconds: unit.duration || 0,
    });
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const expandAllSections = () => {
    const allExpanded: Record<string, boolean> = {};
    course.sections.forEach((s) => {
      allExpanded[s.id] = true;
    });
    setExpandedSections(allExpanded);
  };

  const collapseAllSections = () => {
    setExpandedSections({});
  };

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: Ctrl+K, Cmd+K, Ctrl+F, Cmd+F or '/' to trigger search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const activeTag = activeEl?.tagName.toLowerCase();
      const isInputActive =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (activeEl as HTMLElement)?.isContentEditable;

      const isCmdOrCtrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
      const isCmdOrCtrlF = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f';
      const isSlash = e.key === '/' && !isInputActive;

      if (isCmdOrCtrlK || isCmdOrCtrlF || isSlash) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }

      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter sections and units based on search query
  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return course.sections;

    return course.sections
      .map((section) => {
        const sectionTitleMatches = section.title.toLowerCase().includes(query);
        const matchingUnits = section.units.filter((unit) => {
          const titleMatch = (unit.unitTitle || '').toLowerCase().includes(query);
          const subtitleMatch = (unit.subtitle || '').toLowerCase().includes(query);
          const typeMatch = (unit.type || '').toLowerCase().includes(query);
          return titleMatch || subtitleMatch || typeMatch;
        });

        if (sectionTitleMatches) {
          return section;
        }
        if (matchingUnits.length > 0) {
          return {
            ...section,
            units: matchingUnits,
          };
        }
        return null;
      })
      .filter(Boolean) as typeof course.sections;
  }, [course.sections, searchQuery]);

  useEffect(() => {
    const updateLastVideo = () => {
      try {
        const stored = localStorage.getItem(`preptea_last_video_${course.slug}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setLastVideoInfo((prev) => {
            if (prev?.videoId === parsed.videoId && prev?.timestamp === parsed.timestamp) {
              return prev;
            }
            return parsed;
          });
        }
      } catch (e) {
        // ignore
      }
    };

    updateLastVideo();
    window.addEventListener('preptea_study_update', updateLastVideo);
    window.addEventListener('storage', updateLastVideo);

    // Reconcile multi-device resume state on mount and window focus
    const reconcileFromCloud = () => {
      fetchUserProgressFromDb(true).then((data) => {
        if (data?.coursesProgress?.[course.slug]) {
          const cp = data.coursesProgress[course.slug];
          if (cp.lastVideoId) {
            setLastVideoInfo((prev) => {
              const serverTime = cp.updatedAt ? new Date(cp.updatedAt).getTime() : 0;
              const localTime = prev && (prev as any).updatedAt ? new Date((prev as any).updatedAt).getTime() : 0;
              if (serverTime >= localTime) {
                return {
                  videoId: cp.lastVideoId,
                  title: cp.lastVideoTitle || 'Lesson',
                  timestamp: cp.lastPlaybackTime || 0,
                  updatedAt: cp.updatedAt,
                } as any;
              }
              return prev;
            });
          }
        }
      });
    };

    reconcileFromCloud();
    window.addEventListener('focus', reconcileFromCloud);

    return () => {
      window.removeEventListener('preptea_study_update', updateLastVideo);
      window.removeEventListener('storage', updateLastVideo);
      window.removeEventListener('focus', reconcileFromCloud);
    };
  }, [course.slug]);

  // Calculate specific content type breakdown (Videos, Quizzes, Downloadables)
  const contentCounts = useMemo(() => {
    let video = 0;
    let quiz = 0;
    let ebook = 0;
    const secs = course.sections;
    for (let s = 0; s < secs.length; s++) {
      const units = secs[s].units;
      for (let u = 0; u < units.length; u++) {
        const t = (units[u].objectType || units[u].type || '').toLowerCase();
        if (t === 'ivideo' || t === 'youtube') video++;
        else if (t === 'assessmentv2' || t === 'assessment' || t === 'quiz') quiz++;
        else if (t === 'pbebook' || t === 'ebook') ebook++;
      }
    }
    return { video, quiz, ebook };
  }, [course]);

  return (
    <article className="space-y-8">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb">
        <Link
          href="/courses"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Courses</span>
        </Link>
      </nav>

      {/* Locked Course Banner Notice */}
      {!isUnlocked && (
        <aside aria-label="Batch locked notice" className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs font-semibold flex items-center gap-3">
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="font-bold text-amber-200">Batch Locked</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400/80 mt-0.5">
              You are viewing the course syllabus and unit list. Video playback for this batch requires batch authorization from admin or redeem code activation.
            </p>
          </div>
        </aside>
      )}

      {/* Course Banner Header */}
      <header className="glass-panel rounded-2xl sm:rounded-3xl p-5 sm:p-7 md:p-8 border border-card-border space-y-4 sm:space-y-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
              {course.title}
            </h1>
            {course.isOngoing && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                Ongoing Course
              </span>
            )}
          </div>

          {course.keywords && (
            <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
              {course.keywords.replace(/&amp;/g, '&')}
            </p>
          )}
        </div>

        {lastVideoInfo && isUnlocked && (
          <div className="pt-0.5">
            <Link
              prefetch={false}
              href={`/courses/${course.slug}/video/${lastVideoInfo.videoId}`}
              className="w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2.5 px-4 sm:px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-xs shadow-md shadow-primary-600/25 transition-all active:scale-[0.98] group max-w-full"
            >
              <Play className="w-3.5 h-3.5 fill-white shrink-0 group-hover:scale-110 transition-transform" />
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="font-extrabold shrink-0">Resume Learning:</span>
                <span className="text-[11px] font-medium text-primary-100 truncate">
                  {lastVideoInfo.title || 'Video Lesson'}
                </span>
                <span className="text-[11px] font-mono text-primary-200/90 shrink-0">
                  ({Math.floor((lastVideoInfo.timestamp || 0) / 60)}:{(Math.floor((lastVideoInfo.timestamp || 0) % 60) < 10 ? '0' : '') + Math.floor((lastVideoInfo.timestamp || 0) % 60)})
                </span>
              </div>
            </Link>
          </div>
        )}

        {/* Minimal & Modern Offline Course Downloads Bar */}
        {isUnlocked && totalCourseVideos > 0 && (
          <div
            aria-label="Course Offline Downloads"
            className="rounded-xl sm:rounded-2xl p-3.5 sm:px-4 sm:py-3 bg-card/40 hover:bg-card/60 border border-card-border/80 hover:border-card-border transition-all flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-500 flex items-center justify-center shrink-0">
                <ArrowDownToLine className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold text-foreground">
                    Offline Course Downloads
                  </h3>
                  {isCourseFullyDownloaded && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Complete</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate sm:whitespace-normal">
                  {isCourseActiveDownloading && batchProgress
                    ? `Downloading (${batchProgress.quality || selectedQuality}): ${batchProgress.currentVideoTitle || 'Lesson'} (${batchProgress.completedItems}/${batchProgress.totalItems})`
                    : isCourseFullyDownloaded
                    ? `All ${totalCourseVideos} offline video lessons downloaded to this browser for offline playback.`
                    : `${courseDownloadedCount} of ${totalCourseVideos} offline video lessons downloaded.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 justify-end">
              {isCourseActiveDownloading ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-primary-600/15 border border-primary-500/25 text-primary-400 text-xs font-semibold flex items-center justify-center gap-2 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Downloading ({batchProgress?.quality || selectedQuality})...</span>
                  </div>
                  <button
                    type="button"
                    onClick={cancelBatchDownload}
                    className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/20 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : isCourseFullyDownloaded ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Link
                    prefetch={false}
                    href="/downloads"
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    <span>Downloads ({courseDownloadedCount})</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteCourseDownloads(course.slug)}
                    className="p-2 rounded-xl bg-card hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 border border-card-border transition-all cursor-pointer"
                    title="Remove all course downloads"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleDownloadCourse}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    <span>
                      Download {totalCourseVideos - courseDownloadedCount}{' '}
                      {totalCourseVideos - courseDownloadedCount === 1 ? 'lesson' : 'lessons'}
                    </span>
                  </button>
                  <Link
                    prefetch={false}
                    href="/downloads"
                    className="px-3 py-2 rounded-xl bg-card hover:bg-card-border/60 text-muted-foreground hover:text-foreground text-xs font-semibold border border-card-border transition-all text-center shrink-0"
                  >
                    Downloads{courseDownloadedCount > 0 ? ` (${courseDownloadedCount})` : ''}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Course Breakdown Header Stats Bar */}
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-6 pt-3.5 border-t border-card-border/70 text-xs text-muted-foreground">
          {course.sectionsCount > 0 && (
            <div className="flex items-center gap-2 p-2 sm:p-0 rounded-xl bg-card-border/20 sm:bg-transparent min-w-0">
              <Layers className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
              <span className="truncate"><strong className="text-foreground">{course.sectionsCount}</strong> Sections</span>
            </div>
          )}

          {contentCounts.video > 0 && (
            <div className="flex items-center gap-2 p-2 sm:p-0 rounded-xl bg-card-border/20 sm:bg-transparent min-w-0">
              <Video className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate"><strong className="text-foreground">{contentCounts.video}</strong> Videos</span>
            </div>
          )}

          {contentCounts.quiz > 0 && (
            <div className="flex items-center gap-2 p-2 sm:p-0 rounded-xl bg-card-border/20 sm:bg-transparent min-w-0">
              <FileCheck2 className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
              <span className="truncate"><strong className="text-foreground">{contentCounts.quiz}</strong> Quizzes</span>
            </div>
          )}

          {contentCounts.ebook > 0 && (
            <div className="flex items-center gap-2 p-2 sm:p-0 rounded-xl bg-card-border/20 sm:bg-transparent min-w-0">
              <BookOpen className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="truncate"><strong className="text-foreground">{contentCounts.ebook}</strong> {contentCounts.ebook === 1 ? 'Downloadable File' : 'Downloadable Files'}</span>
            </div>
          )}

          {formatCourseDuration(course.totalDurationSeconds) && (
            <div className="flex items-center gap-2 p-2 sm:p-0 rounded-xl bg-card-border/20 sm:bg-transparent min-w-0">
              <Clock className="w-4 h-4 text-violet-400 shrink-0" />
              <span className="truncate"><strong className="text-foreground">{formatCourseDuration(course.totalDurationSeconds)}</strong> Total</span>
            </div>
          )}
        </div>
      </header>

      {/* Section Syllabus & Calendar Roadmap Modes */}
      <section aria-labelledby="curriculum-heading" className="space-y-6">
        {/* Mode Switcher Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-card-border/60">
          <div>
            <h2 id="curriculum-heading" className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2.5">
              {viewMode === 'calendar' ? (
                <>
                  <CalendarDays className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  <span>Calendar & Daily Targets</span>
                </>
              ) : (
                <>
                  <Layers className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  <span>Course Curriculum</span>
                </>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {viewMode === 'calendar'
                ? 'Chronological daily targets grouped by upload dates with streak tracker.'
                : 'Browse all course chapters, sections, and syllabus modules.'}
            </p>
          </div>

          {/* Mode Switcher Segmented Control */}
          <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto p-1 rounded-2xl bg-card border border-card-border shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => handleSetViewMode('default')}
              className={`justify-center px-3.5 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'default'
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card-border/40'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Default Mode</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetViewMode('calendar')}
              className={`justify-center px-3.5 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card-border/40'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>Calendar Mode</span>
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black">
                <Flame className="w-3 h-3 fill-amber-400" />
                <span className="hidden xs:inline">Streak</span>
              </span>
            </button>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <CourseCalendarView
            course={course}
            availableTests={availableTests}
            isUnlocked={isUnlocked}
            completedVideos={completedVideos}
            onToggleComplete={handleToggleComplete}
            onBatchToggleComplete={handleBatchToggleComplete}
            onDownloadUnit={handleDownloadUnit}
            formatUnitDuration={formatUnitDuration}
            getUnitMetaConfig={getUnitMetaConfig}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="text-sm font-bold text-foreground">
                <span>Sections Overview</span>
                {searchQuery.trim() !== '' && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({filteredSections.length} {filteredSections.length === 1 ? 'section' : 'sections'} found)
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                {/* Search Input Bar */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search section or lesson content..."
                    className="w-full pl-9 pr-12 py-2.5 sm:py-2 rounded-xl bg-card border border-card-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-500 transition-colors"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/70 border border-card-border/80 px-1.5 py-0.5 rounded bg-card/80 pointer-events-none hidden xs:inline-block">
                      ⌘K
                    </kbd>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={expandAllSections}
                    className="flex-1 sm:flex-initial text-center px-3 py-2.5 sm:py-2 rounded-xl bg-card border border-card-border hover:bg-card/80 text-muted-foreground hover:text-foreground font-semibold transition-colors cursor-pointer"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllSections}
                    className="flex-1 sm:flex-initial text-center px-3 py-2.5 sm:py-2 rounded-xl bg-card border border-card-border hover:bg-card/80 text-muted-foreground hover:text-foreground font-semibold transition-colors cursor-pointer"
                  >
                    Collapse All
                  </button>
                </div>
              </div>
            </div>

        {filteredSections.length === 0 ? (
          <div className="p-8 text-center glass-panel rounded-2xl border border-card-border space-y-3">
            <Search className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
            <p className="text-sm font-semibold text-foreground">No matching content found</p>
            <p className="text-xs text-muted-foreground">
              No sections or lessons matched &quot;{searchQuery}&quot;. Try searching for another keyword or section name.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-2 px-4 py-2 rounded-xl bg-primary-600/20 text-primary-400 text-xs font-semibold hover:bg-primary-600 hover:text-white transition-colors cursor-pointer"
            >
              Clear Search Filter
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSections.map((section) => {
              const originalIdx = course.sections.findIndex((s) => s.id === section.id);
              const sIdx = originalIdx >= 0 ? originalIdx : 0;
              const isExpanded = searchQuery.trim() !== '' ? true : !!expandedSections[section.id];
              const sectionSecs = section.units.reduce((acc, u) => acc + (u.duration || 0), 0);
              const formattedSecDuration = formatCourseDuration(sectionSecs);
              const sectionVideoUnits = getSectionVideoUnits(section);
              const isSecDownloading = isSectionDownloading(course.slug, section.title);
              const isSecDownloaded =
                sectionVideoUnits.length > 0 &&
                isSectionDownloaded(course.slug, section.title, sectionVideoUnits.length);

            return (
              <div key={section.id} className="glass-card rounded-2xl border border-card-border overflow-hidden transition-all">
                {/* Section Header (Clickable to Collapse/Expand) */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => toggleSection(section.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSection(section.id);
                    }
                  }}
                  className="w-full text-left p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-primary-500/5 transition-colors cursor-pointer group select-none"
                >
                  {/* === MOBILE VIEW (< sm) === */}
                  <div className="flex flex-col gap-2.5 sm:hidden w-full">
                    {/* Row 1: Number + Title + Chevron on top-right */}
                    <div className="flex items-start justify-between gap-2.5 w-full">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                          {sIdx + 1}
                        </div>
                        <h3 className="text-sm font-bold text-foreground leading-snug">
                          {section.title}
                        </h3>
                      </div>
                      <div className="p-1 rounded-lg bg-card/60 border border-card-border/60 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5">
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* Row 2: Download button (left) + Units & Duration pill (right) - Never wraps */}
                    <div className="flex items-center justify-between gap-2 w-full pt-0.5">
                      {isUnlocked && sectionVideoUnits.length > 0 ? (
                        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                          {isSecDownloading ? (
                            <div className="px-2.5 py-1 rounded-lg bg-primary-500/15 text-primary-400 border border-primary-500/30 text-[11px] font-bold flex items-center gap-1.5 animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Downloading...</span>
                            </div>
                          ) : isSecDownloaded ? (
                            <div className="flex items-center gap-1">
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Saved</span>
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSectionDownloads(course.slug, section.title);
                                }}
                                className="p-1 rounded-lg hover:bg-rose-500/15 text-muted-foreground hover:text-rose-400 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleDownloadSection(e, section)}
                              className="px-2.5 py-1 rounded-lg bg-primary-600/15 hover:bg-primary-600 text-primary-500 dark:text-primary-300 hover:text-white border border-primary-500/25 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                            >
                              <ArrowDownToLine className="w-3 h-3" />
                              <span>Download ({sectionVideoUnits.length})</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground bg-card/80 px-2.5 py-1 rounded-lg border border-card-border/80 shrink-0">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-primary-500/80" />
                          <span>{section.units.length} {section.units.length === 1 ? 'Unit' : 'Units'}</span>
                        </span>
                        {formattedSecDuration && (
                          <>
                            <span className="text-card-border">•</span>
                            <span className="flex items-center gap-1 text-foreground">
                              <Clock className="w-3 h-3 text-primary-500/80" />
                              <span>{formattedSecDuration}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* === DESKTOP & TABLET VIEW (>= sm) === */}
                  <div className="hidden sm:flex items-center justify-between w-full gap-4">
                    {/* Col 1: Section Number & Full Title (Expands to fill available space) */}
                    <div className="flex-1 min-w-0 flex items-center gap-3 pr-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                        {sIdx + 1}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                        {section.title}
                      </h3>
                    </div>

                    {/* Uniform Alignment Cluster: Fixed Column Widths for Mathematical Alignment */}
                    <div className="flex items-center gap-4 shrink-0">
                      {/* Col 2: Download Action Column (Fixed width: 190px, right-aligned) */}
                      <div className="w-[190px] shrink-0 flex items-center justify-end">
                        {isUnlocked && sectionVideoUnits.length > 0 && (
                          <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
                            {isSecDownloading ? (
                              <div className="px-3 py-1.5 rounded-xl bg-primary-500/15 text-primary-400 border border-primary-500/30 text-xs font-bold flex items-center gap-1.5 animate-pulse shadow-xs whitespace-nowrap">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Downloading...</span>
                              </div>
                            ) : isSecDownloaded ? (
                              <div className="flex items-center gap-1.5">
                                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Section Saved</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSectionDownloads(course.slug, section.title);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-rose-500/15 text-muted-foreground hover:text-rose-400 transition-colors border border-transparent hover:border-rose-500/30 cursor-pointer"
                                  title="Delete section downloads"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleDownloadSection(e, section)}
                                className="px-3 py-1.5 rounded-xl bg-primary-600/15 hover:bg-primary-600 text-primary-500 dark:text-primary-300 hover:text-white border border-primary-500/25 hover:border-transparent text-xs font-bold transition-all flex items-center gap-1.5 hover:scale-102 active:scale-95 cursor-pointer shadow-xs whitespace-nowrap"
                                title={`Download all ${sectionVideoUnits.length} video lessons in this section`}
                              >
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                                <span>Download Section ({sectionVideoUnits.length})</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Col 3: Units & Duration Pill (Fixed width: 175px, right-aligned) */}
                      <div className="w-[175px] shrink-0 flex items-center justify-end">
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-card/80 px-3 py-1.5 rounded-xl border border-card-border/80 shadow-xs whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-primary-500/80" />
                            <span>{section.units.length} {section.units.length === 1 ? 'Unit' : 'Units'}</span>
                          </span>

                          {formattedSecDuration && (
                            <>
                              <span className="text-card-border">•</span>
                              <span className="flex items-center gap-1 text-foreground">
                                <Clock className="w-3.5 h-3.5 text-primary-500/80" />
                                <span>{formattedSecDuration}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Col 4: Chevron Toggle Icon (Fixed width: 32px, centered) */}
                      <div className="w-8 shrink-0 flex items-center justify-center">
                        <div className="p-1.5 rounded-lg bg-card/60 border border-card-border/60 text-muted-foreground group-hover:text-foreground transition-colors">
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Units List (Only shown when expanded) */}
                {isExpanded && (
                  <div role="list" className="p-3 sm:p-6 pt-0 space-y-2.5 border-t border-card-border/60 mt-1 pt-3 sm:pt-4">
                    {section.units.map((unit, uIdx) => {
                      const config = getUnitMetaConfig(unit);
                      const IconComp = config.icon;

                      // Read fileUrl directly from unit (parsed from course JSON)
                      const downloadUrl = unit.fileUrl;

                      const matchingTest = config.isActionableExam
                        ? availableTests.find((t) => {
                            // Priority 1: Exact object_id match (unit.id === t.objectId)
                            if (unit.id && (t.objectId === unit.id || t.assessmentId === unit.id)) {
                              return true;
                            }
                            // Priority 2: Exact assessmentId match (unit.data.assessmentId === t.assessmentId)
                            if (unit.data?.assessmentId && (t.assessmentId === unit.data.assessmentId || t.objectId === unit.data.assessmentId)) {
                              return true;
                            }
                            return false;
                          }) ||
                          availableTests.find((t) => {
                            // Priority 3: Exact title/quizId match
                            const cleanUnitTitle = (unit.unitTitle || '').toLowerCase().trim();
                            const cleanQuizId = t.quizId.toLowerCase().trim();
                            return cleanUnitTitle && cleanQuizId === cleanUnitTitle;
                          })
                        : null;

                      return (
                        <div
                          role="listitem"
                          key={unit.id}
                          className="p-2.5 sm:p-3.5 rounded-xl bg-card/60 border border-card-border/80 flex items-center justify-between gap-2.5 sm:gap-4 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border ${config.colorClass}`}>
                              <IconComp className="w-4 h-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                                {unit.unitTitle !== 'Untitled' ? unit.unitTitle : `${section.title} Lesson ${uIdx + 1}`}
                              </p>
                              {(formatUnitDuration(unit.duration) || unit.modifiedF) && config.isActionableVideo && (
                                <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 font-mono">
                                  {formatUnitDuration(unit.duration) && (
                                    <span>{formatUnitDuration(unit.duration)}</span>
                                  )}
                                  {formatUnitDuration(unit.duration) && unit.modifiedF && <span>•</span>}
                                  {unit.modifiedF && (
                                    <span title={unit.modifiedF}>{unit.modifiedF.split(' ')[0]}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Button: Download File / eBook */}
                          {downloadUrl ? (
                            <a
                              href={downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              className="px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-foreground text-xs font-bold transition-all border border-teal-500/30 hover:border-transparent flex items-center gap-1.5 shrink-0"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download File</span>
                            </a>
                          ) : (config.category === 'ebook' || unit.type === 'pbebook' || unit.type === 'ebook') ? (
                            <div className="px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-teal-950/40 text-teal-300 text-xs font-bold border border-teal-500/30 flex items-center gap-1.5 shrink-0">
                              <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                              <span>eBook Notes</span>
                            </div>
                          ) : null}


                          {/* Action Button: Take Exam / Give Test */}
                          {config.isActionableExam && !downloadUrl && (matchingTest || unit.data?.assessmentId) && (() => {
                            const quizIdToUse = matchingTest?.quizId || unit.data?.assessmentId || unit.id;
                            return (
                              <Link
                                href={`/quiz/${quizIdToUse}`}
                                className="px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-primary-600/20 hover:bg-primary-600 text-primary-600 dark:text-primary-300 hover:text-white text-xs font-bold transition-all border border-primary-500/30 hover:border-transparent flex items-center gap-1 shrink-0"
                              >
                                <span>Take Exam</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            );
                          })()}

                          {/* Action Button: Watch Lesson / Video Not Available / Locked Video */}
                          {config.isActionableVideo && (() => {
                            const isYouTube = (unit.objectType || unit.type || '').toLowerCase() === 'youtube';
                            const uId = unit.sourceid || unit.id;
                            const isDownloadedUnit = isUnlocked && (isDownloaded(uId) || isDownloaded(unit.sourceid || '') || isDownloaded(unit.id || ''));
                            const isQueuedUnit = isUnlocked && (isQueued(uId) || isQueued(unit.sourceid || '') || isQueued(unit.id || ''));
                            const isPausedUnit = isUnlocked && (isPaused(uId) || isPaused(unit.sourceid || '') || isPaused(unit.id || ''));
                            const isDownloadingUnit = isUnlocked && (isDownloading(uId) || isDownloading(unit.sourceid || '') || isDownloading(unit.id || ''));
                            const isFailedUnit = isUnlocked && (isFailed(uId) || isFailed(unit.sourceid || '') || isFailed(unit.id || ''));
                            const unitProgress = isUnlocked ? (getDownloadProgress(uId) ?? getDownloadProgress(unit.sourceid || '') ?? getDownloadProgress(unit.id || '')) : undefined;

                            return isUnlocked ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isDownloadedUnit ? (
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await deleteDownload(uId);
                                      if (unit.sourceid && unit.sourceid !== uId) await deleteDownload(unit.sourceid);
                                      if (unit.id && unit.id !== uId) await deleteDownload(unit.id);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 hover:border-rose-500/50 text-rose-400 hover:text-rose-300 text-[10px] font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                                    title="Delete downloaded video from this device"
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-400" />
                                  </button>
                                ) : isQueuedUnit ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      pauseDownload(uId);
                                    }}
                                    title="Queued in sequence. Click to pause."
                                    className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/40 text-slate-300 text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>Queued</span>
                                  </button>
                                ) : isPausedUnit ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      resumeDownload(uId);
                                    }}
                                    title="Download paused. Click to resume."
                                    className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-[10px] font-bold flex items-center gap-1.5 cursor-pointer group transition-colors"
                                  >
                                    <Play className="w-3 h-3 fill-amber-400 text-amber-400 group-hover:scale-110 transition-transform" />
                                    <span>Resume {unitProgress !== undefined ? `${unitProgress}%` : ''}</span>
                                  </button>
                                ) : isDownloadingUnit ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      pauseDownload(uId);
                                    }}
                                    title="Downloading offline... Click to pause."
                                    className="px-2 py-1 rounded-lg bg-primary-500/15 hover:bg-amber-500/20 border border-primary-500/30 hover:border-amber-500/40 text-primary-400 hover:text-amber-300 text-[10px] font-bold flex items-center gap-1.5 cursor-pointer group transition-all"
                                  >
                                    <Loader2 className="w-3 h-3 animate-spin group-hover:hidden" />
                                    <Pause className="w-3 h-3 hidden group-hover:inline text-amber-400" />
                                    <span className="group-hover:hidden">{unitProgress !== undefined ? `${unitProgress}%` : 'Saving'}</span>
                                    <span className="hidden group-hover:inline">Pause</span>
                                  </button>
                                ) : isFailedUnit ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      retryDownload(uId);
                                    }}
                                    title="Download failed. Click to retry."
                                    className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <RotateCcw className="w-3 h-3 text-rose-400" />
                                    <span>Retry</span>
                                  </button>
                                ) : !isYouTube ? (
                                  <button
                                    type="button"
                                    onClick={(e) => handleDownloadUnit(e, unit, section.title, section.id)}
                                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-primary-600/20 text-muted-foreground hover:text-primary-400 border border-slate-700/60 hover:border-primary-500/30 transition-all cursor-pointer"
                                    title="Download this lesson offline"
                                  >
                                    <ArrowDownToLine className="w-3.5 h-3.5" />
                                  </button>
                                ) : null}

                                <Link
                                  prefetch={false}
                                  href={`/courses/${course.slug}/video/${unit.sourceid || unit.id}`}
                                  className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                                    isDownloadedUnit
                                      ? 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30'
                                      : 'bg-primary-600/20 hover:bg-primary-600 text-primary-600 dark:text-primary-300 hover:text-white border border-primary-500/30 hover:border-transparent'
                                  }`}
                                >
                                  <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                                  {isDownloadedUnit ? (
                                    <>
                                      <span className="hidden sm:inline">Watch Offline</span>
                                      <span className="sm:hidden">Offline</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="hidden sm:inline">Watch Lesson</span>
                                      <span className="sm:hidden">Watch</span>
                                    </>
                                  )}
                                </Link>
                              </div>
                            ) : (
                              <Link
                                prefetch={false}
                                href={`/courses/${course.slug}/video/${unit.sourceid || unit.id}`}
                                className="px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 text-amber-600 dark:text-amber-400 text-xs font-bold transition-all border border-amber-500/30 flex items-center gap-1.5 shrink-0"
                              >
                                <Lock className="w-3.5 h-3.5 shrink-0" />
                                <span className="hidden sm:inline">Locked Video</span>
                                <span className="sm:hidden">Locked</span>
                              </Link>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
          </div>
        )}
      </section>

      {/* Bundle Quality Selector Modal */}
      {bundleQualityModal && (
        <div
          onClick={() => setBundleQualityModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[92vh] overflow-y-auto custom-scrollbar p-5 sm:p-6 rounded-3xl bg-card border border-card-border shadow-2xl space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-400">
                <Sparkles className="w-4 h-4" />
                <span>Select Download Quality</span>
              </div>
              <button
                onClick={() => setBundleQualityModal(null)}
                className="p-1 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                {bundleQualityModal.type === 'course'
                  ? 'Download Entire Course'
                  : `Download Section: ${bundleQualityModal.title}`}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Choose video resolution for {bundleQualityModal.totalVideos} lesson{bundleQualityModal.totalVideos === 1 ? '' : 's'}. Videos are stored inside your browser for offline viewing.
              </p>
            </div>

            {/* Quality Options */}
            <div className="space-y-2.5">
              {[
                {
                  id: '1080p',
                  name: 'Full HD (1080p)',
                  desc: 'Maximum sharpness & detail',
                  badge: 'Crisp',
                },
                {
                  id: '720p',
                  name: 'High (720p)',
                  desc: 'Crisp & clear video',
                  badge: 'Recommended',
                },
                {
                  id: '540p',
                  name: 'Medium (540p)',
                  desc: 'Balanced data & quality',
                  badge: 'Balanced',
                },
                {
                  id: '360p',
                  name: 'Standard (360p)',
                  desc: 'Fast download & low storage',
                  badge: 'Standard',
                },
              ].map((opt) => {
                const estSize = formatBatchEstimatedSize(opt.id);
                const isSelected = selectedQuality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedQuality(opt.id)}
                    className={`w-full p-3 sm:p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary-950/40 border-primary-500/60 ring-1 ring-primary-500/30'
                        : 'bg-card hover:bg-slate-800/40 border-card-border/80'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-foreground">{opt.name}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{opt.desc}</p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {estSize && (
                        <span className="text-[11px] sm:text-xs font-mono font-medium text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-700/60">
                          {estSize}
                        </span>
                      )}
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-primary-500 bg-primary-500 text-white'
                            : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Remember quality preference (YouTube style) */}
            <div className="pt-2 border-t border-card-border/60 space-y-1.5">
              <label className="flex items-center justify-between gap-2.5 px-1 cursor-pointer select-none group">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberPreference}
                    onChange={(e) => setRememberPreference(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-primary-600 focus:ring-primary-500 bg-slate-900 cursor-pointer accent-primary-500"
                  />
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary-300 transition-colors">
                    Remember my download settings
                  </span>
                </div>
                <Link
                  href="/downloads#download-settings"
                  onClick={() => setBundleQualityModal(null)}
                  className="text-[11px] text-muted-foreground hover:text-primary-400 flex items-center gap-1 transition-colors"
                  title="Manage download preferences"
                >
                  <Settings className="w-3 h-3" />
                  <span>Settings</span>
                </Link>
              </label>
              <p className="text-[10px] text-muted-foreground px-1 leading-relaxed">
                {rememberPreference
                  ? 'Future downloads will start automatically in this resolution. You can switch back to "Ask each time" anytime in Downloads settings.'
                  : 'Unchecked: PrepTea will ask you to choose resolution every time.'}
              </p>
            </div>

            {/* Confirm Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-card-border/60">
              <button
                type="button"
                onClick={() => setBundleQualityModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const modal = bundleQualityModal;
                  setBundleQualityModal(null);
                  if (!canDownload) {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('preptea:premium-download-required'));
                    }
                    return;
                  }
                  saveRememberedQuality(selectedQuality, rememberPreference);
                  if (modal.type === 'course') {
                    const sectionsPayload = course.sections.map((sec) => ({
                      sectionTitle: sec.title,
                      sectionId: sec.id,
                      units: getSectionVideoUnits(sec),
                    }));
                    await downloadCourse({
                      courseSlug: course.slug,
                      courseTitle: course.title,
                      preferredQuality: selectedQuality,
                      sections: sectionsPayload,
                    });
                  } else if (modal.section) {
                    const units = getSectionVideoUnits(modal.section);
                    await downloadSection({
                      courseSlug: course.slug,
                      courseTitle: course.title,
                      sectionTitle: modal.section.title,
                      sectionId: modal.section.id,
                      preferredQuality: selectedQuality,
                      units,
                    });
                  }
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-500 text-white shadow-md shadow-primary-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>Start Download ({selectedQuality})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Lesson Quality Modal */}
      <DownloadLessonModal
        target={singleDownloadModal}
        onClose={() => setSingleDownloadModal(null)}
        onStartDownload={startDownload}
      />
    </article>
  );
}
