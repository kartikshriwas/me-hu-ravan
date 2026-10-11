"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  ListVideo,
  CheckCircle2,
  ArrowDownToLine,
  Loader2,
  Sparkles,
  X,
  Clock,
  Pause,
  Trash2,
  Play,
  Settings,
  Sliders,
} from "lucide-react";
import { useDownloads } from "@/lib/downloadContext";
import { useAuth } from "@/lib/authContext";
import { checkUserCourseAccess } from "@/lib/batchAccess";
import { DownloadLessonModal, SingleLessonDownloadTarget } from "@/components/DownloadLessonModal";
import { getRememberedQuality, saveRememberedQuality } from "@/lib/qualityMatcher";

interface Unit {
  id: string;
  sourceid?: string;
  unitTitle?: string;
  title?: string;
  type: string;
  duration?: number;
  data?: {
    embed?: string;
    [key: string]: any;
  };
}

interface Section {
  sectionTitle?: string;
  title?: string;
  units: Unit[];
}

interface VideoPlaylistSidebarProps {
  courseTitle: string;
  courseSlug: string;
  currentVideoId: string;
  sections: Section[];
}

function formatUnitDuration(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  }
  return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
}

function formatSectionDuration(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

export function VideoPlaylistSidebar({
  courseTitle,
  courseSlug,
  currentVideoId,
  sections,
}: VideoPlaylistSidebarProps) {
  const { user } = useAuth();
  const hasCourseAccess = checkUserCourseAccess(user);
  const {
    downloads,
    downloadingMap,
    batchProgress,
    isDownloaded,
    isDownloading,
    isQueued,
    isPaused,
    getDownloadProgress,
    startDownload,
    isSectionDownloaded,
    isSectionDownloading,
    downloadSection,
    deleteSectionDownloads,
    isCourseDownloaded,
    isCourseDownloading,
    downloadCourse,
    deleteCourseDownloads,
    deleteDownload,
    pauseDownload,
    resumeDownload,
  } = useDownloads();
  const [isOpen, setIsOpen] = useState(false); // kept for potential future use
  const [expandedSections, setExpandedSections] = useState<
    Record<number, boolean>
  >({});
  const [completedVideos, setCompletedVideos] = useState<string[]>([]);
  const [playbackMap, setPlaybackMap] = useState<Record<string, { time: number; duration: number }>>({});
  const [bundleQualityModal, setBundleQualityModal] = useState<{
    isOpen: boolean;
    type: 'course' | 'section';
    title: string;
    sectionTitle?: string;
    units: { videoId: string; unitTitle: string; duration?: number }[];
    totalVideos: number;
  } | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<'1080p' | '720p' | '540p' | '360p' | string>('720p');
  const [rememberPreference, setRememberPreference] = useState<boolean>(false);

  useEffect(() => {
    setSelectedQuality(getRememberedQuality('720p'));
    if (typeof window !== 'undefined') {
      setRememberPreference(localStorage.getItem('preptea_remember_download_quality') === 'true');
    }
  }, []);

  const [singleDownloadModal, setSingleDownloadModal] = useState<SingleLessonDownloadTarget | null>(null);

  const handleInitiateSingleDownload = (
    uId: string,
    title: string,
    sectionName: string,
    duration?: number
  ) => {
    if (typeof window !== 'undefined' && localStorage.getItem('preptea_remember_download_quality') === 'true') {
      const prefQuality = getRememberedQuality('720p');
      startDownload({
        videoId: uId,
        courseSlug,
        courseTitle,
        sectionTitle: sectionName,
        unitTitle: title,
        thumbnailUrl: '',
        durationSeconds: duration || 0,
        quality: prefQuality,
      });
      return;
    }
    setSingleDownloadModal({
      videoId: uId,
      courseSlug,
      courseTitle,
      sectionTitle: sectionName,
      unitTitle: title,
      durationSeconds: duration || 0,
    });
  };

  // Count downloadable video units across the entire course
  const courseVideoUnits = React.useMemo(() => {
    const list: {
      videoId: string;
      unitTitle: string;
      sectionTitle: string;
      duration?: number;
    }[] = [];

    sections.forEach((sec, sIdx) => {
      const sTitle = sec.title || sec.sectionTitle || `Section ${sIdx + 1}`;
      sec.units.forEach((u, uIdx) => {
        const isYouTube =
          u.type === 'youtube' ||
          (u.data && !!u.data.embed);
        const videoId = u.sourceid || (!isYouTube && u.id ? u.id : '');
        if (videoId && !isYouTube) {
          list.push({
            videoId,
            unitTitle: u.unitTitle || u.title || `${sTitle} Lesson ${uIdx + 1}`,
            sectionTitle: sTitle,
            duration: u.duration,
          });
        }
      });
    });

    return list;
  }, [sections]);

  const totalCourseVideos = courseVideoUnits.length;
  const isCourseFullySaved =
    totalCourseVideos > 0 && isCourseDownloaded(courseSlug, totalCourseVideos);
  const isCourseSaving = isCourseDownloading(courseSlug);

  const formatBundleEstimatedSize = (quality: string) => {
    if (!bundleQualityModal) return '';
    const kbpsMap: Record<string, number> = {
      '1080p': 924,
      '720p': 552,
      '540p': 393,
      '360p': 267,
    };
    const kbps = kbpsMap[quality] || 552;
    const numVideos = bundleQualityModal.totalVideos || 1;
    const totalSecs = bundleQualityModal.units.reduce((acc, u) => acc + (u.duration || 0), 0);

    if (totalSecs > 0) {
      const totalBytes = totalSecs * (kbps * 1000 / 8);
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

  const handleDownloadEntireCourse = async () => {
    if (!hasCourseAccess || totalCourseVideos === 0) return;
    const rem = typeof window !== 'undefined' && localStorage.getItem('preptea_remember_download_quality') === 'true';
    if (rem) {
      const pref = getRememberedQuality('720p');
      const sectionsPayload = sections.map((sec, sIdx) => {
        const sTitle = sec.title || sec.sectionTitle || `Section ${sIdx + 1}`;
        const validUnits = sec.units
          .filter((u) => {
            const isYouTube = u.type === 'youtube' || (u.data && !!u.data.embed);
            return (u.sourceid || u.id) && !isYouTube;
          })
          .map((u, uIdx) => ({
            videoId: (u.sourceid || u.id)!,
            unitTitle: u.unitTitle || u.title || `${sTitle} Lesson ${uIdx + 1}`,
            duration: u.duration,
          }));
        return {
          sectionTitle: sTitle,
          units: validUnits,
        };
      });
      await downloadCourse({
        courseSlug,
        courseTitle,
        preferredQuality: pref,
        sections: sectionsPayload,
      });
      return;
    }
    const pref = getRememberedQuality('720p');
    setSelectedQuality(pref);
    setBundleQualityModal({
      isOpen: true,
      type: 'course',
      title: courseTitle,
      units: courseVideoUnits,
      totalVideos: totalCourseVideos,
    });
  };

  const handleDownloadSection = async (sectionName: string, videoUnits: any[]) => {
    if (!hasCourseAccess || videoUnits.length === 0) return;
    const unitsToDownload = videoUnits.map((u, uIdx) => ({
      videoId: (u.sourceid || u.id)!,
      unitTitle: u.unitTitle || u.title || `${sectionName} Lesson ${uIdx + 1}`,
      duration: u.duration,
    }));
    const rem = typeof window !== 'undefined' && localStorage.getItem('preptea_remember_download_quality') === 'true';
    if (rem) {
      const pref = getRememberedQuality('720p');
      await downloadSection({
        courseSlug,
        courseTitle,
        sectionTitle: sectionName,
        preferredQuality: pref,
        units: unitsToDownload,
      });
      return;
    }
    const pref = getRememberedQuality('720p');
    setSelectedQuality(pref);
    setBundleQualityModal({
      isOpen: true,
      type: 'section',
      title: sectionName,
      sectionTitle: sectionName,
      units: unitsToDownload,
      totalVideos: unitsToDownload.length,
    });
  };

  const confirmBundleDownload = async () => {
    if (!bundleQualityModal) return;
    const modal = bundleQualityModal;
    setBundleQualityModal(null);
    saveRememberedQuality(selectedQuality, rememberPreference);

    if (modal.type === 'course') {
      const sectionsPayload = sections.map((sec, sIdx) => {
        const sTitle = sec.title || sec.sectionTitle || `Section ${sIdx + 1}`;
        const validUnits = sec.units
          .filter((u) => {
            const isYouTube = u.type === 'youtube' || (u.data && !!u.data.embed);
            return (u.sourceid || u.id) && !isYouTube;
          })
          .map((u, uIdx) => ({
            videoId: (u.sourceid || u.id)!,
            unitTitle: u.unitTitle || u.title || `${sTitle} Lesson ${uIdx + 1}`,
            duration: u.duration,
          }));
        return {
          sectionTitle: sTitle,
          units: validUnits,
        };
      });

      await downloadCourse({
        courseSlug,
        courseTitle,
        preferredQuality: selectedQuality,
        sections: sectionsPayload,
      });
    } else {
      await downloadSection({
        courseSlug,
        courseTitle,
        sectionTitle: modal.sectionTitle || modal.title,
        preferredQuality: selectedQuality,
        units: modal.units,
      });
    }
  };

  const desktopActiveRef = useRef<HTMLAnchorElement | null>(null);
  const mobileActiveRef = useRef<HTMLAnchorElement | null>(null);
  const desktopPlaylistRef = useRef<HTMLDivElement | null>(null);
  const mobilePlaylistRef = useRef<HTMLDivElement | null>(null);

  // Load completed videos from localStorage & listen for updates
  useEffect(() => {
    const updateCompleted = () => {
      try {
        const stored = localStorage.getItem("preptea_completed_videos");
        const nextList: string[] = stored ? JSON.parse(stored) : [];
        setCompletedVideos((prev) => {
          if (
            prev.length === nextList.length &&
            prev.every((val, idx) => val === nextList[idx])
          ) {
            return prev;
          }
          return nextList;
        });

        const playbackStored = localStorage.getItem("preptea_video_playback_map");
        if (playbackStored) {
          const parsed = JSON.parse(playbackStored);
          setPlaybackMap((prev) => {
            if (JSON.stringify(prev) === playbackStored) return prev;
            return parsed;
          });
        }
      } catch (e) {
        // ignore
      }
    };
    updateCompleted();
    window.addEventListener("preptea_study_update", updateCompleted);
    window.addEventListener("storage", updateCompleted);
    return () => {
      window.removeEventListener("preptea_study_update", updateCompleted);
      window.removeEventListener("storage", updateCompleted);
    };
  }, [currentVideoId]);

  // Expand section containing the currently playing video by default
  useEffect(() => {
    const newExpandedState: Record<number, boolean> = {};
    sections.forEach((section, sIdx) => {
      const hasActive = section.units.some(
        (u) => (u.sourceid || u.id) === currentVideoId,
      );
      if (hasActive) {
        newExpandedState[sIdx] = true;
      }
    });
    if (Object.keys(newExpandedState).length === 0) {
      newExpandedState[0] = true;
    }
    setExpandedSections((prev) => ({ ...prev, ...newExpandedState }));
  }, [currentVideoId, sections]);

  // Auto-scroll to the currently playing item within the scrollable container
  useEffect(() => {
    const timer = setTimeout(() => {
      // Desktop container scroll
      if (desktopPlaylistRef.current && desktopActiveRef.current) {
        const container = desktopPlaylistRef.current;
        const el = desktopActiveRef.current;
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        if (containerRect.height > 0 && elRect.height > 0) {
          const offset = elRect.top - containerRect.top;
          container.scrollTo({
            top: container.scrollTop + offset - 40,
            behavior: "smooth",
          });
        }
      }

      // Mobile container scroll
      if (mobilePlaylistRef.current && mobileActiveRef.current) {
        const container = mobilePlaylistRef.current;
        const el = mobileActiveRef.current;
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        if (containerRect.height > 0 && elRect.height > 0) {
          const offset = elRect.top - containerRect.top;
          container.scrollTo({
            top: container.scrollTop + offset - 40,
            behavior: "smooth",
          });
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [currentVideoId, expandedSections]);

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Calculate total playable videos & progress
  const totalVideos = sections.reduce((acc, sec) => {
    return (
      acc +
      sec.units.filter(
        (u) =>
          !!u.sourceid || u.type === "youtube" || (u.data && !!u.data.embed),
      ).length
    );
  }, 0);

  const completedCount = sections.reduce((acc, sec) => {
    return (
      acc +
      sec.units.filter((u) => completedVideos.includes(u.sourceid || u.id))
        .length
    );
  }, 0);

  const progressPercent =
    totalVideos > 0 ? Math.round((completedCount / totalVideos) * 100) : 0;

  // Find currently active section
  const activeSection = sections.find((sec) =>
    sec.units.some((u) => (u.sourceid || u.id) === currentVideoId),
  );
  const activeSectionTitle =
    activeSection?.title || activeSection?.sectionTitle;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* ── Desktop Playlist Header ── */}
      <div className="hidden lg:flex items-center justify-between p-3.5 sm:p-4 bg-card/90 border-b border-card-border/80 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <div className="w-8 h-8 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
            <ListVideo className="w-4.5 h-4.5 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="min-w-0">
            <Link
              href={`/courses/${courseSlug}`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors bg-card/80"
            >
              <h4
                className="text-xs font-bold text-foreground truncate"
                title={courseTitle}
              >
                {courseTitle}
              </h4>
            </Link>
            {completedCount > 0 ? (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                {completedCount}/{totalVideos} Completed ({progressPercent}%)
              </p>
            ) : activeSectionTitle ? (
              <p
                className="text-[10px] text-primary-600 dark:text-primary-300 font-medium truncate"
                title={activeSectionTitle}
              >
                {activeSectionTitle} • {totalVideos} Videos
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground font-medium">
                {totalVideos} Video Lessons
              </p>
            )}
          </div>
        </div>

        {/* Download Entire Course Action */}
        {hasCourseAccess && totalCourseVideos > 0 && (
          <div className="shrink-0">
            {isCourseSaving ? (
              <div className="px-2.5 py-1.5 rounded-xl bg-primary-500/15 border border-primary-500/30 text-primary-400 text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Downloading {batchProgress?.quality ? `(${batchProgress.quality})` : ''}...</span>
              </div>
            ) : isCourseFullySaved ? (
              <button
                type="button"
                onClick={() => deleteCourseDownloads(courseSlug)}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-rose-500/10 border border-emerald-500/30 hover:border-rose-500/30 text-emerald-400 hover:text-rose-400 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer group/btn"
                title="All course lessons downloaded offline. Click to remove."
              >
                <CheckCircle2 className="w-3 h-3 group-hover/btn:hidden" />
                <span className="group-hover/btn:hidden">Saved</span>
                <span className="hidden group-hover/btn:inline">Remove</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownloadEntireCourse}
                className="px-2.5 py-1.5 rounded-xl bg-primary-600/15 hover:bg-primary-600/25 border border-primary-500/30 hover:border-primary-500/50 text-primary-400 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title={`Download entire course (${totalCourseVideos} lessons) for offline watching`}
              >
                <ArrowDownToLine className="w-3 h-3" />
                <span>Save Course</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Mobile Playlist Header ── */}
      <div className="lg:hidden flex items-center justify-between px-3 py-2.5 bg-card/90 border-b border-card-border/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <ListVideo className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
          <div className="min-w-0">
            <Link
              href={`/courses/${courseSlug}`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors bg-card/80"
            >
              <h4
                className="text-xs font-bold text-foreground truncate"
                title={courseTitle}
              >
                {courseTitle}
              </h4>
            </Link>
            {completedCount > 0 ? (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                {completedCount}/{totalVideos} Completed ({progressPercent}%)
              </p>
            ) : activeSectionTitle ? (
              <p
                className="text-[10px] text-primary-600 dark:text-primary-300 font-medium truncate"
                title={activeSectionTitle}
              >
                {activeSectionTitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasCourseAccess && totalCourseVideos > 0 && (
            isCourseSaving ? (
              <span className="px-2 py-1 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-400 flex items-center gap-1 text-[10px] font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{batchProgress?.quality || 'Saving'}</span>
              </span>
            ) : isCourseFullySaved ? (
              <button
                type="button"
                onClick={() => deleteCourseDownloads(courseSlug)}
                className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:text-rose-400"
                title="Course saved offline. Tap to remove."
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownloadEntireCourse}
                className="p-1.5 rounded-lg hover:bg-slate-700/60 text-muted-foreground hover:text-primary-400 border border-transparent hover:border-slate-700/60 transition-colors"
                title="Download entire course offline"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
              </button>
            )
          )}
          <span className="text-[10px] font-mono text-muted-foreground bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60 shrink-0">
            {totalVideos} vids
          </span>
        </div>
      </div>

      {/* ── Active Batch Progress Banner ── */}
      {batchProgress?.isDownloading && batchProgress.courseSlug === courseSlug && (
        <div className="px-3.5 py-2.5 bg-primary-950/40 border-b border-primary-500/20 flex flex-col gap-1.5 animate-in fade-in">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <Loader2 className="w-3 h-3 text-primary-400 animate-spin shrink-0" />
              <span className="font-semibold text-foreground truncate">
                Downloading {batchProgress.type === 'course' ? 'Course' : 'Section'}
              </span>
              {batchProgress.quality && (
                <span className="px-1.5 py-0.2 rounded bg-primary-500/20 text-primary-300 border border-primary-500/40 text-[9px] font-bold">
                  {batchProgress.quality}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
              {batchProgress.completedItems}/{batchProgress.totalItems}
            </span>
          </div>
          {batchProgress.currentVideoTitle && (
            <p className="text-[10px] text-muted-foreground truncate">
              Current: {batchProgress.currentVideoTitle}
            </p>
          )}
          <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{
                width: `${Math.round(((batchProgress.completedItems) / Math.max(1, batchProgress.totalItems)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Thin Course Progress Bar */}
      {completedCount > 0 && (
        <div className="w-full h-1 bg-background shrink-0">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Desktop: scrollable bounded box */}
      <div
        ref={desktopPlaylistRef}
        className="hidden lg:block flex-1 overflow-y-auto custom-scrollbar scroll-smooth p-3"
      >
        {sections.map((section, sIdx) => {
          const videoUnits = section.units.filter(
            (u) =>
              !!u.sourceid ||
              u.type === "youtube" ||
              (u.data && !!u.data.embed),
          );
          if (videoUnits.length === 0) return null;
          const isExpanded = expandedSections[sIdx] ?? false;
          const sectionName =
            section.title || section.sectionTitle || "Course Section";
          const hasActiveVideo = videoUnits.some(
            (u) => (u.sourceid || u.id) === currentVideoId,
          );

          return (
            <div key={sIdx} className="space-y-1 mb-3">
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleSection(sIdx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSection(sIdx);
                  }
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all group touch-manipulation cursor-pointer select-none ${
                  hasActiveVideo
                    ? "bg-primary-950/40 border border-primary-500/40 shadow-sm shadow-primary-500/10 ring-1 ring-primary-500/20"
                    : "bg-background/60 border border-card-border/60 hover:bg-background"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Layers
                    className={`w-3.5 h-3.5 shrink-0 ${hasActiveVideo ? "text-primary-600 dark:text-primary-400 animate-pulse" : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-xs font-bold truncate transition-colors ${
                      hasActiveVideo
                        ? "text-foreground"
                        : "text-foreground group-hover:text-foreground"
                    }`}
                  >
                    {sectionName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {hasCourseAccess && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const isSecDownloaded = isSectionDownloaded(courseSlug, sectionName, videoUnits.length);
                        if (isSecDownloaded) {
                          deleteSectionDownloads(courseSlug, sectionName);
                        } else {
                          handleDownloadSection(sectionName, videoUnits);
                        }
                      }}
                      className="p-1 rounded-md hover:bg-slate-700/60 text-muted-foreground hover:text-primary-400 transition-colors"
                      title={
                        isSectionDownloaded(courseSlug, sectionName, videoUnits.length)
                          ? 'Remove section downloads'
                          : `Download all ${videoUnits.length} lessons in this section`
                      }
                    >
                      {isSectionDownloading(courseSlug, sectionName) ? (
                        <div className="flex items-center gap-1 text-primary-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {batchProgress?.quality && <span className="text-[9px] font-bold">{batchProgress.quality}</span>}
                        </div>
                      ) : isSectionDownloaded(courseSlug, sectionName, videoUnits.length) ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <ArrowDownToLine className="w-3 h-3" />
                      )}
                    </button>
                  )}
                  {(() => {
                    const secSecs = videoUnits.reduce(
                      (acc, u) => acc + (u.duration || 0),
                      0,
                    );
                    const formattedSecDur = formatSectionDuration(secSecs);
                    return (
                      <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        {videoUnits.length}{" "}
                        {videoUnits.length === 1 ? "vid" : "vids"}
                        {formattedSecDur && (
                          <span className="text-muted-foreground font-sans text-[10px] bg-card/80 px-1 py-0.5 rounded border border-card-border">
                            {formattedSecDur}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="space-y-1 pl-1">
                  {videoUnits.map((unit) => {
                    const uId = unit.sourceid || unit.id;
                    const isActive = uId === currentVideoId;
                    const isCompleted = completedVideos.includes(uId);
                    const title =
                      unit.unitTitle || unit.title || "Video Lesson";

                    const playback = playbackMap[uId];
                    const progressPercent =
                      playback && playback.duration > 0 && playback.time > 5
                        ? Math.min(100, Math.round((playback.time / playback.duration) * 100))
                        : 0;

                    return (
                      <Link
                        key={unit.id}
                        ref={isActive ? desktopActiveRef : null}
                        href={`/courses/${courseSlug}/video/${uId}`}
                        className={`flex items-center justify-between p-2.5 rounded-xl transition-all touch-manipulation ${
                          isActive
                            ? "bg-primary-600/25 border border-primary-500/50 text-white font-bold shadow-md shadow-primary-600/10 ring-1 ring-primary-500/30"
                            : "hover:bg-slate-800/60 border border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {isActive ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-primary-400 animate-pulse shrink-0" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <PlayCircle className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs truncate">{title}</span>
                              {hasCourseAccess && (
                                isDownloaded(uId) ? (
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      await deleteDownload(uId);
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-[9px] font-bold shrink-0 flex items-center gap-1 border border-rose-500/30 transition-colors cursor-pointer"
                                    title="Delete downloaded video from this device"
                                  >
                                    <Trash2 className="w-2.5 h-2.5 text-rose-400" />
                                  </button>
                                ) : isQueued(uId) ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      pauseDownload(uId);
                                    }}
                                    title="Queued for download. Click to pause." 
                                    className="px-1.5 py-0.5 rounded bg-slate-500/20 hover:bg-slate-500/30 text-slate-400 text-[9px] font-bold shrink-0 flex items-center gap-1 border border-slate-500/30 cursor-pointer"
                                  >
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>Queued</span>
                                  </button>
                                ) : isPaused(uId) ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      resumeDownload(uId);
                                    }}
                                    title="Download paused. Click to resume." 
                                    className="px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-[9px] font-bold shrink-0 flex items-center gap-1 border border-amber-500/30 cursor-pointer transition-colors"
                                  >
                                    <Play className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                    <span>Resume {getDownloadProgress(uId) || 0}%</span>
                                  </button>
                                ) : isDownloading(uId) ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      pauseDownload(uId);
                                    }}
                                    title="Downloading lesson. Click to pause." 
                                    className="px-1.5 py-0.5 rounded bg-primary-500/15 hover:bg-amber-500/20 text-primary-400 hover:text-amber-300 text-[9px] font-bold shrink-0 flex items-center gap-1 border border-primary-500/30 hover:border-amber-500/40 cursor-pointer group transition-all"
                                  >
                                    <Loader2 className="w-2.5 h-2.5 animate-spin group-hover:hidden" />
                                    <Pause className="w-2.5 h-2.5 hidden group-hover:inline text-amber-400" />
                                    <span className="group-hover:hidden">{downloadingMap[uId]?.quality ? `${downloadingMap[uId].quality} • ` : ''}{getDownloadProgress(uId)}%</span>
                                    <span className="hidden group-hover:inline">Pause</span>
                                  </button>
                                ) : null
                              )}
                            </div>
                            {progressPercent > 0 && !isCompleted && (
                              <div className="w-full bg-slate-700/40 rounded-full h-1 mt-1 overflow-hidden" title={`${progressPercent}% watched`}>
                                <div className="bg-primary-500 h-1 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {hasCourseAccess && !isDownloaded(uId) && !isDownloading(uId) && !isPaused(uId) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleInitiateSingleDownload(uId, title, sectionName, unit.duration);
                              }}
                              className="p-1 rounded-md hover:bg-slate-700/60 text-slate-500 hover:text-primary-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Download lesson offline"
                            >
                              <ArrowDownToLine className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isActive ? (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary-500/30 text-primary-600 dark:text-primary-300">
                              Playing
                            </span>
                          ) : isCompleted ? (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                              Done
                            </span>
                          ) : formatUnitDuration(unit.duration) ? (
                            <span className="text-[10px] font-mono text-slate-500">
                              {formatUnitDuration(unit.duration)}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: flat YouTube-style list — scrollable within its container */}
      <div
        ref={mobilePlaylistRef}
        className="lg:hidden flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-slate-800/50"
      >
        {sections.map((section, sIdx) => {
          const videoUnits = section.units.filter(
            (u) =>
              !!u.sourceid ||
              u.type === "youtube" ||
              (u.data && !!u.data.embed),
          );
          if (videoUnits.length === 0) return null;
          const sectionName =
            section.title || section.sectionTitle || "Course Section";
          const hasActiveVideo = videoUnits.some(
            (u) => (u.sourceid || u.id) === currentVideoId,
          );

          return (
            <div key={sIdx}>
              {/* Section Label */}
              <div
                className={`flex items-center gap-2 px-3 py-2 sticky top-0 z-10 backdrop-blur-md border-y transition-colors ${
                  hasActiveVideo
                    ? "bg-primary-950/90 border-primary-500/40 shadow-sm shadow-primary-500/20"
                    : "bg-background/90 border-card-border/60"
                }`}
              >
                <Layers
                  className={`w-3.5 h-3.5 shrink-0 ${hasActiveVideo ? "text-primary-600 dark:text-primary-400 animate-pulse" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider truncate ${
                    hasActiveVideo
                      ? "text-primary-200 font-extrabold"
                      : "text-foreground/80"
                  }`}
                >
                  {sectionName}
                </span>
                {/* {hasActiveVideo && (
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary-500/30 text-primary-600 dark:text-primary-300 border border-primary-500/40 shrink-0 ml-1">
                    Playing Section
                  </span>
                )} */}
                {hasCourseAccess && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const isSecDownloaded = isSectionDownloaded(courseSlug, sectionName, videoUnits.length);
                      if (isSecDownloaded) {
                        deleteSectionDownloads(courseSlug, sectionName);
                      } else {
                        handleDownloadSection(sectionName, videoUnits);
                      }
                    }}
                    className="p-1 rounded-md hover:bg-slate-700/60 text-muted-foreground hover:text-primary-400 transition-colors ml-auto mr-1"
                    title={
                      isSectionDownloaded(courseSlug, sectionName, videoUnits.length)
                        ? 'Remove section downloads'
                        : `Download all ${videoUnits.length} lessons in this section`
                    }
                  >
                    {isSectionDownloading(courseSlug, sectionName) ? (
                      <div className="flex items-center gap-1 text-primary-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {batchProgress?.quality && <span className="text-[9px] font-bold">{batchProgress.quality}</span>}
                      </div>
                    ) : isSectionDownloaded(courseSlug, sectionName, videoUnits.length) ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <ArrowDownToLine className="w-3 h-3" />
                    )}
                  </button>
                )}
                {(() => {
                  const secSecs = videoUnits.reduce(
                    (acc, u) => acc + (u.duration || 0),
                    0,
                  );
                  const formattedSecDur = formatSectionDuration(secSecs);
                  return (
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground bg-card px-1.5 py-0.5 rounded border border-card-border shrink-0 flex items-center gap-1">
                      <span>{videoUnits.length} vids</span>
                      {formattedSecDur && (
                        <span className="text-foreground/80 font-sans border-l border-slate-700 pl-1">
                          {formattedSecDur}
                        </span>
                      )}
                    </span>
                  );
                })()}
              </div>

              {/* Video rows */}
              {videoUnits.map((unit) => {
                const uId = unit.sourceid || unit.id;
                const isActive = uId === currentVideoId;
                const isCompleted = completedVideos.includes(uId);
                const title = unit.unitTitle || unit.title || "Video Lesson";

                const playback = playbackMap[uId];
                const progressPercent =
                  playback && playback.duration > 0 && playback.time > 5
                    ? Math.min(100, Math.round((playback.time / playback.duration) * 100))
                    : 0;

                return (
                  <Link
                    key={unit.id}
                    ref={isActive ? mobileActiveRef : null}
                    href={`/courses/${courseSlug}/video/${uId}`}
                    className={`flex items-center gap-3 px-3 py-3 transition-all touch-manipulation ${
                      isActive
                        ? "bg-primary-600/15 border-l-2 border-primary-500"
                        : "border-l-2 border-transparent hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Thumbnail placeholder / indicator */}
                    <div
                      className={`relative w-12 h-8 rounded-lg shrink-0 flex items-center justify-center overflow-hidden ${
                        isActive
                          ? "bg-primary-500/20"
                          : isCompleted
                            ? "bg-emerald-950/40 border border-emerald-500/30"
                            : "bg-slate-800"
                      }`}
                    >
                      {isActive ? (
                        <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <PlayCircle className="w-4 h-4 text-slate-500" />
                      )}
                      {progressPercent > 0 && !isCompleted && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700/60">
                          <div className="bg-primary-500 h-full" style={{ width: `${progressPercent}%` }} />
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs leading-snug line-clamp-2 ${
                          isActive
                            ? "text-foreground font-semibold"
                            : "text-foreground/80"
                        }`}
                      >
                        {title}
                      </p>
                      {isActive ? (
                        <span className="text-[9px] font-bold text-primary-600 dark:text-primary-400 mt-0.5 block">
                          Now Playing
                        </span>
                      ) : isCompleted ? (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block flex items-center gap-1">
                          Completed
                        </span>
                      ) : progressPercent > 0 ? (
                        <span className="text-[9px] font-medium text-primary-400 mt-0.5 block">
                          {progressPercent}% watched
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 mt-0.5">
                          {hasCourseAccess && (
                            isDownloaded(uId) ? (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  await deleteDownload(uId);
                                }}
                                className="text-[8.5px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-0.5 cursor-pointer"
                                title="Delete downloaded video from this device"
                              >
                                <Trash2 className="w-2.5 h-2.5 text-rose-400" />
                              </button>
                            ) : isQueued(uId) ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  pauseDownload(uId);
                                }}
                                title="Queued for download. Click to pause."
                                className="text-[8.5px] font-bold text-slate-400 hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                              >
                                <Clock className="w-2.5 h-2.5" />
                                <span>Queued</span>
                              </button>
                            ) : isPaused(uId) ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  resumeDownload(uId);
                                }}
                                title="Download paused. Click to resume."
                                className="text-[8.5px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                              >
                                <Play className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                <span>Resume {getDownloadProgress(uId) || 0}%</span>
                              </button>
                            ) : isDownloading(uId) ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  pauseDownload(uId);
                                }}
                                title="Downloading lesson. Click to pause."
                                className="text-[8.5px] font-bold text-primary-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                              >
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                <span>{downloadingMap[uId]?.quality ? `${downloadingMap[uId].quality} • ` : ''}{getDownloadProgress(uId)}%</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleInitiateSingleDownload(uId, title, sectionName, unit.duration);
                                }}
                                className="text-[8.5px] text-muted-foreground hover:text-primary-400 flex items-center gap-0.5 cursor-pointer"
                                title="Download lesson offline"
                              >
                                <ArrowDownToLine className="w-2.5 h-2.5" /> Download
                              </button>
                            )
                          )}
                          {formatUnitDuration(unit.duration) && (
                            <span className="text-[9px] font-mono text-slate-500 block">
                              {formatUnitDuration(unit.duration)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
        {/* bottom spacer */}
        <div className="h-6" />
      </div>

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
                Choose video resolution for {bundleQualityModal.totalVideos} lesson{bundleQualityModal.totalVideos === 1 ? '' : 's'}. Lessons will be saved inside your browser for offline viewing.
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
                const estSize = formatBundleEstimatedSize(opt.id);
                const isSelected = selectedQuality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedQuality(opt.id as any)}
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
                onClick={confirmBundleDownload}
                className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-600/30 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
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
    </div>
  );
}
