'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowDownToLine,
  CheckCircle2,
  Trash2,
  Play,
  Search,
  HardDrive,
  Film,
  WifiOff,
  Sparkles,
  ArrowRight,
  BookOpen,
  X,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  SkipBack,
  SkipForward,
  Clock,
  Filter,
  List,
  LayoutGrid,
  Loader2,
  RotateCcw,
  Pause,
  Settings,
  Sliders,
  SlidersHorizontal,
  HelpCircle,
  Info,
  Check,
  Tv,
  Crown,
  ExternalLink,
} from 'lucide-react';
import { useDownloads } from '@/lib/downloadContext';
import { OfflineVideoMetadata } from '@/lib/videoStorage';
import { useAuth } from '@/lib/authContext';
import { getRememberedQuality, saveRememberedQuality } from '@/lib/qualityMatcher';
import { checkUserCourseAccess, checkCanDownload, verifyAndGetCachedBatchAccess, CachedBatchAccess } from '@/lib/batchAccess';
import { CustomVideoPlayer } from '@/components/CustomVideoPlayer';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface GroupedSection {
  sectionTitle: string;
  totalBytes: number;
  totalDurationSeconds: number;
  videos: OfflineVideoMetadata[];
}

interface GroupedCourse {
  courseSlug: string;
  courseTitle: string;
  totalVideos: number;
  totalBytes: number;
  totalDurationSeconds: number;
  sectionList: GroupedSection[];
}

export function DownloadsClient() {
  const { user, loading: authLoading } = useAuth();
  const [isOnline, setIsOnline] = useState(true);

  const {
    downloads,
    downloadingMap,
    storageUsage,
    batchProgress,
    deleteDownload,
    deleteSectionDownloads,
    deleteCourseDownloads,
    clearAllDownloads,
    cancelBatchDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    pauseAllDownloads,
    resumeAllDownloads,
    getBlobUrl,
    revokeBlobUrl,
  } = useDownloads();

  const [viewMode, setViewMode] = useState<'courses' | 'videos'>('courses');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'syllabus' | 'recent' | 'size' | 'title'>('syllabus');

  // Expanded sections state: courseSlug -> sectionTitle -> boolean
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Confirmation Modals
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmCourseDelete, setConfirmCourseDelete] = useState<{
    slug: string;
    title: string;
    count: number;
  } | null>(null);
  const [confirmSectionDelete, setConfirmSectionDelete] = useState<{
    slug: string;
    courseTitle: string;
    sectionTitle: string;
    count: number;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Active in-page offline playback modal
  const [activePlaybackVideo, setActivePlaybackVideo] = useState<OfflineVideoMetadata | null>(null);
  const [activePlaybackUrl, setActivePlaybackUrl] = useState<string | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);

  // Download Quality Preferences (YouTube Style)
  const [rememberQuality, setRememberQuality] = useState<boolean>(false);
  const [preferredQuality, setPreferredQuality] = useState<string>('720p');
  const [qualityToast, setQualityToast] = useState<string | null>(null);
  const [showQualityDropdown, setShowQualityDropdown] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; right: number } | null>(null);
  const qualityButtonRef = useRef<HTMLButtonElement>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateDropdownCoords = () => {
    if (qualityButtonRef.current) {
      const rect = qualityButtonRef.current.getBoundingClientRect();
      setDropdownCoords({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      });
    }
  };

  const handleToggleQualityDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showQualityDropdown) {
      updateDropdownCoords();
      setShowQualityDropdown(true);
    } else {
      setShowQualityDropdown(false);
    }
  };

  useEffect(() => {
    if (!showQualityDropdown) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (qualityButtonRef.current && qualityButtonRef.current.contains(target)) {
        return;
      }
      if (qualityMenuRef.current && qualityMenuRef.current.contains(target)) {
        return;
      }
      setShowQualityDropdown(false);
    }

    function handleScrollOrResize() {
      if (window.innerWidth >= 640) {
        updateDropdownCoords();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize);
    };
  }, [showQualityDropdown]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const rem = localStorage.getItem('preptea_remember_download_quality') === 'true';
      const pref = getRememberedQuality('720p');
      setRememberQuality(rem);
      setPreferredQuality(pref);
    }
  }, []);

  const handleUpdateQualitySetting = (choice: 'ask_each_time' | '1080p' | '720p' | '540p' | '360p' | string) => {
    if (typeof window === 'undefined') return;
    if (choice === 'ask_each_time') {
      localStorage.removeItem('preptea_remember_download_quality');
      setRememberQuality(false);
      setQualityToast('Settings updated: PrepTea will now ask you to choose quality before each download.');
    } else {
      saveRememberedQuality(choice);
      setRememberQuality(true);
      setPreferredQuality(choice);
      setQualityToast(`Settings updated: Future downloads will automatically download in ${choice}.`);
    }
    setTimeout(() => setQualityToast(null), 4000);
  };

  // Monitor online / offline network status
  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [cachedAccess, setCachedAccess] = useState<CachedBatchAccess | null>(null);
  const [isVerifyingOfflineAccess, setIsVerifyingOfflineAccess] = useState(false);

  useEffect(() => {
    if (isOnline) {
      setIsVerifyingOfflineAccess(false);
      return;
    }
    async function verify() {
      const access = await verifyAndGetCachedBatchAccess();
      setCachedAccess(access);
      setIsVerifyingOfflineAccess(false);
    }
    verify();
  }, [isOnline]);

  // Keyboard shortcut listener: Escape to close cinema player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activePlaybackVideo) {
        handleClosePlayer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePlaybackVideo, activePlaybackUrl]);

  // Note: early returns (404 guard and loader) have been moved to the bottom to respect hooks order

  // Distinct courses for filter pills
  const coursesList = useMemo(() => {
    const set = new Set<string>();
    downloads.forEach((d) => {
      if (d.courseTitle) set.add(d.courseTitle);
    });
    return Array.from(set);
  }, [downloads]);

  // Filtered & sorted downloads list
  const filteredDownloads = useMemo(() => {
    let list = downloads.filter((d) => {
      const matchSearch =
        d.unitTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.courseTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.sectionTitle && d.sectionTitle.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCourse = selectedCourse === 'all' || d.courseTitle === selectedCourse;
      return matchSearch && matchCourse;
    });

    if (sortBy === 'size') {
      list = [...list].sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
    } else if (sortBy === 'title') {
      list = [...list].sort((a, b) => a.unitTitle.localeCompare(b.unitTitle));
    } else if (sortBy === 'syllabus') {
      list = [...list].sort((a, b) => (a.downloadedAt || 0) - (b.downloadedAt || 0));
    } else {
      list = [...list].sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));
    }

    return list;
  }, [downloads, searchQuery, selectedCourse, sortBy]);

  // Group downloads by Course and Section
  const groupedCourses: GroupedCourse[] = useMemo(() => {
    const map: Record<string, {
      courseSlug: string;
      courseTitle: string;
      totalVideos: number;
      totalBytes: number;
      totalDurationSeconds: number;
      sections: Record<string, GroupedSection>;
    }> = {};

    filteredDownloads.forEach((video) => {
      const cSlug = video.courseSlug || 'unknown';
      if (!map[cSlug]) {
        map[cSlug] = {
          courseSlug: cSlug,
          courseTitle: video.courseTitle || 'Untitled Course',
          totalVideos: 0,
          totalBytes: 0,
          totalDurationSeconds: 0,
          sections: {},
        };
      }

      const course = map[cSlug];
      course.totalVideos += 1;
      course.totalBytes += video.sizeBytes || 0;
      course.totalDurationSeconds += video.durationSeconds || 0;

      const sTitle = video.sectionTitle || 'General Lessons';
      if (!course.sections[sTitle]) {
        course.sections[sTitle] = {
          sectionTitle: sTitle,
          totalBytes: 0,
          totalDurationSeconds: 0,
          videos: [],
        };
      }

      const sec = course.sections[sTitle];
      sec.totalBytes += video.sizeBytes || 0;
      sec.totalDurationSeconds += video.durationSeconds || 0;
      sec.videos.push(video);
    });

    return Object.values(map)
      .filter((course) => course.totalVideos > 0)
      .map((course) => ({
        courseSlug: course.courseSlug,
        courseTitle: course.courseTitle,
        totalVideos: course.totalVideos,
        totalBytes: course.totalBytes,
        totalDurationSeconds: course.totalDurationSeconds,
        sectionList: Object.values(course.sections)
          .filter((sec) => sec.videos && sec.videos.length > 0)
          .map((sec) => ({
            ...sec,
            videos: (sortBy === 'recent' || sortBy === 'syllabus')
              ? [...sec.videos].sort((a, b) => (a.downloadedAt || 0) - (b.downloadedAt || 0))
              : sec.videos,
          })),
      }));
  }, [filteredDownloads, sortBy]);

  // Open inline offline video player
  const handlePlayOffline = async (video: OfflineVideoMetadata) => {
    setActivePlaybackVideo(video);
    setPlaybackLoading(true);
    try {
      const url = await getBlobUrl(video.videoId);
      setActivePlaybackUrl(url);
    } catch (e) {
      console.error('Failed to prepare offline playback blob:', e);
      alert('Could not load downloaded video stream from local storage.');
    } finally {
      setPlaybackLoading(false);
    }
  };

  const handleClosePlayer = () => {
    if (activePlaybackUrl) {
      revokeBlobUrl(activePlaybackUrl);
    }
    setActivePlaybackVideo(null);
    setActivePlaybackUrl(null);
  };

  // Next / Previous navigation within player
  const activePlaylist = useMemo(() => {
    if (viewMode === 'courses' && activePlaybackVideo) {
      const courseGroup = groupedCourses.find(
        (c) => c.courseSlug === activePlaybackVideo.courseSlug
      );
      if (courseGroup) {
        return courseGroup.sectionList.flatMap((s) => s.videos);
      }
    }
    return filteredDownloads;
  }, [viewMode, activePlaybackVideo, groupedCourses, filteredDownloads]);

  const currentActiveIndex = activePlaybackVideo
    ? activePlaylist.findIndex((v) => v.videoId === activePlaybackVideo.videoId)
    : -1;
  const prevVideo = currentActiveIndex > 0 ? activePlaylist[currentActiveIndex - 1] : null;
  const nextVideo =
    currentActiveIndex >= 0 && currentActiveIndex < activePlaylist.length - 1
      ? activePlaylist[currentActiveIndex + 1]
      : null;

  const handleSkipNext = () => {
    if (nextVideo) {
      handlePlayOffline(nextVideo);
    }
  };

  const handleSkipPrev = () => {
    if (prevVideo) {
      handlePlayOffline(prevVideo);
    }
  };

  const handleDeleteItem = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    if (activePlaybackVideo?.videoId === videoId) {
      handleClosePlayer();
    }
    await deleteDownload(videoId);
    setDeletingId(null);
  };

  const toggleSectionCollapse = (key: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Determine effective access:
  // When online: check live session
  // When offline: check cached batch access status
  const liveAccess = checkUserCourseAccess(user);
  const effectiveAccess = isOnline ? liveAccess : (cachedAccess?.hasAccess ?? liveAccess);
  const canDownload = checkCanDownload(user);

  // Loading skeleton while mounting or awaiting auth/offline access verification
  if (!mounted || authLoading || (!isOnline && isVerifyingOfflineAccess)) {
    return (
      <div className="w-full h-[50vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  // 404 Authorization Guard: Unauthorized access throws 404 Not Found (matching /courses and /admin)
  if (!effectiveAccess) {
    notFound();
  }

  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8" role="main">

      {/* Free / Demo User Upgrade Banner */}
      {user && !canDownload && !authLoading && (
        <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between gap-4 flex-wrap animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Offline Downloads is a Premium Feature</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upgrade to Premium or purchase a course batch to save video lessons for high-speed offline playback.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('preptea:premium-download-required'));
                }
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
            >
              Upgrade to Premium
            </button>
          </div>
        </div>
      )}
      
      {/* Offline Status Reassurance Banner */}
      {!isOnline && (
        <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-500 animate-in fade-in">
          <WifiOff className="w-5 h-5 shrink-0" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold text-foreground">You are currently offline. </span>
            <span className="text-muted-foreground">
              All saved videos below are stored locally and will play smoothly without an internet connection.
            </span>
          </div>
        </div>
      )}

      {/* Active Batch Download Progress Banner (Floating/Sticky) */}
      {batchProgress?.isDownloading && (
        <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-primary-950/80 via-card to-card border border-primary-500/40 shadow-xl shadow-primary-950/20 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary-500/20 border border-primary-500/40 flex items-center justify-center text-primary-400 shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded border border-primary-500/20">
                    {batchProgress.type === 'course' ? 'Downloading Course' : 'Downloading Section'}
                  </span>
                  {batchProgress.quality && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shadow-xs">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>{batchProgress.quality}</span>
                    </span>
                  )}
                  <span className="text-xs font-bold text-foreground truncate">
                    {batchProgress.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  Saving: <strong className="text-foreground">{batchProgress.currentVideoTitle || 'Lesson'}</strong> ({batchProgress.completedItems + 1} of {batchProgress.totalItems})
                  {batchProgress.quality && (
                    <span className="ml-1.5 text-primary-400 font-semibold">• Quality: {batchProgress.quality}</span>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={cancelBatchDownload}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition-all shrink-0 cursor-pointer"
            >
              Cancel Batch
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/50">
            <div
              className="bg-gradient-to-r from-primary-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
              style={{
                width: `${batchProgress.totalItems > 0 ? Math.min(100, Math.round((batchProgress.completedItems / batchProgress.totalItems) * 100)) : 10}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Active Downloads Queue (YouTube Style) */}
      {Object.keys(downloadingMap).length > 0 && (
        <section aria-labelledby="active-downloads-heading" className="glass-panel rounded-3xl p-5 sm:p-6 border border-primary-500/30 shadow-2xl space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary-500/20 text-primary-400 flex items-center justify-center font-bold">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <h2 id="active-downloads-heading" className="text-sm font-bold text-foreground">
                  Downloads in Progress ({Object.keys(downloadingMap).length})
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Downloads run sequentially to preserve bandwidth and stability
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={pauseAllDownloads}
                className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                Pause all
              </button>
              <button
                type="button"
                onClick={resumeAllDownloads}
                className="px-3 py-1 rounded-xl bg-primary-600/30 hover:bg-primary-600/50 text-primary-300 text-xs font-semibold border border-primary-500/30 transition-all cursor-pointer"
              >
                Resume all
              </button>
            </div>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar">
            {Object.entries(downloadingMap).map(([vId, item]) => (
              <div
                key={vId}
                className="p-3 rounded-2xl bg-slate-900/60 border border-card-border/80 flex items-center justify-between gap-3 hover:border-primary-500/30 transition-all"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-foreground truncate">
                      {item.unitTitle || 'Video Lesson'}
                    </h3>
                    <span className="text-[10px] font-mono font-bold text-primary-400 bg-primary-950/80 px-1.5 py-0.2 rounded border border-primary-500/30 shrink-0">
                      {item.quality}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded shrink-0 ${
                      item.status === 'downloading'
                        ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                        : item.status === 'queued'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {item.status === 'downloading' ? `${item.progress}%` : item.status}
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span>
                      {formatBytes(item.bytesReceived)} / {formatBytes(item.totalBytes)}
                    </span>
                    {item.speedBytesPerSec !== undefined && item.speedBytesPerSec > 0 && (
                      <span>
                        {formatBytes(item.speedBytesPerSec)}/s • ~{item.etaSeconds || 0}s left
                      </span>
                    )}
                  </div>

                  {item.qualityFallbackNotice && (
                    <div className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center justify-between gap-1 flex-wrap">
                      <span>
                        ⚠️ {item.qualityFallbackNotice.requestedQuality} unavailable • Using {item.qualityFallbackNotice.actualQuality}
                      </span>
                      {item.qualityFallbackNotice.availableQualities && item.qualityFallbackNotice.availableQualities.length > 1 && (
                        <span className="text-[9px] text-amber-300 font-mono">
                          (Options: {item.qualityFallbackNotice.availableQualities.join(', ')})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.status === 'paused' ? (
                    <button
                      type="button"
                      onClick={() => resumeDownload(vId)}
                      className="p-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white transition-all cursor-pointer"
                      title="Resume download"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => pauseDownload(vId)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                      title="Pause download"
                    >
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => cancelDownload(vId)}
                    className="p-1.5 rounded-xl hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-all cursor-pointer"
                    title="Cancel download"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Page Header */}
      <header className="glass-panel rounded-3xl p-6 sm:p-8 border border-card-border shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative group hover:border-primary-500/30 transition-all duration-500">
        {/* Subtle decorative glowing blob */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-primary-500/25 transition-all duration-700 overflow-hidden" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-700 overflow-hidden" />

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-extrabold text-xs tracking-widest uppercase">
            <ArrowDownToLine className="w-4 h-4" />
            <span>Site Downloads Vault</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-primary-500/70 bg-clip-text text-transparent">
            Downloaded Videos
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
            Watch your downloaded video lessons inside PrepTea anytime. Videos are saved directly to this browser and will not clutter your personal device gallery.
          </p>
        </div>

        {/* Header Actions: Minimal Quality Dropdown & Storage */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 relative z-30">
          {/* Minimal Quality Preference Dropdown (YouTube style) */}
          <div className="relative">
            <button
              ref={qualityButtonRef}
              type="button"
              onClick={handleToggleQualityDropdown}
              className={`group relative flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all duration-300 cursor-pointer select-none backdrop-blur-xl shadow-xs ${
                showQualityDropdown
                  ? 'bg-primary-500/15 border-primary-500/50 ring-2 ring-primary-500/20 text-foreground shadow-md'
                  : 'bg-card/85 hover:bg-card border-card-border/80 hover:border-primary-500/40 text-foreground/90 hover:text-foreground'
              }`}
              title="Change download quality or switch to Ask each time"
              aria-expanded={showQualityDropdown}
              aria-haspopup="true"
            >
              <div className="w-5 h-5 rounded-lg bg-primary-500/15 border border-primary-500/25 flex items-center justify-center text-primary-400 group-hover:scale-105 transition-transform">
                <SlidersHorizontal className="w-3 h-3" />
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground font-medium hidden xs:inline">Quality:</span>
                <span className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded-lg border transition-colors ${
                  rememberQuality
                    ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                }`}>
                  {rememberQuality ? preferredQuality : 'Ask each time'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-300 ${
                showQualityDropdown ? 'rotate-180 text-primary-400' : 'group-hover:text-foreground'
              }`} />
            </button>
          </div>

          {/* Storage Summary Pill */}
          <div className="p-2 sm:p-2.5 px-3 rounded-2xl bg-card/80 border border-card-border/80 backdrop-blur-md shadow-sm flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-primary-500/15 border border-primary-500/25 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-foreground">
                {formatBytes(storageUsage.usedBytes)}
              </span>
              <span className="text-muted-foreground ml-1">
                ({downloads.length} {downloads.length === 1 ? 'lesson' : 'lessons'})
              </span>
            </div>
          </div>

          {downloads.length > 0 && (
            <button
              onClick={() => setConfirmClearAll(true)}
              className="text-xs font-semibold text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 px-3 py-2 rounded-2xl border border-rose-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </header>

      {/* Floating Modern Toast Notice via Portal */}
      {mounted && qualityToast && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[1000000] max-w-sm sm:max-w-md w-[calc(100%-2rem)] p-3.5 rounded-2xl bg-slate-900/95 border border-emerald-500/40 text-emerald-300 text-xs font-medium shadow-2xl backdrop-blur-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ring-1 ring-white/10 pointer-events-auto">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="leading-snug truncate sm:whitespace-normal">{qualityToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setQualityToast(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white shrink-0 cursor-pointer"
            aria-label="Dismiss toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>,
        document.body
      )}

      {/* Responsive Quality Dropdown Portal (Floating Popover on Desktop & Native Bottom Drawer on Mobile) */}
      {mounted && showQualityDropdown && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] pointer-events-none select-none">
          {/* Mobile Backdrop Overlay */}
          <div
            onClick={() => setShowQualityDropdown(false)}
            className="sm:hidden fixed inset-0 bg-black/75 backdrop-blur-md pointer-events-auto animate-in fade-in duration-200"
          />

          {/* Menu Card */}
          <div
            ref={qualityMenuRef}
            onClick={(e) => e.stopPropagation()}
            style={
              typeof window !== 'undefined' && window.innerWidth >= 640 && dropdownCoords
                ? {
                    top: `${dropdownCoords.top}px`,
                    right: `${dropdownCoords.right}px`,
                  }
                : undefined
            }
            className="pointer-events-auto fixed bottom-0 inset-x-0 sm:inset-x-auto sm:bottom-auto sm:w-84 max-h-[85vh] sm:max-h-[36rem] overflow-y-auto custom-scrollbar rounded-t-[32px] sm:rounded-2xl bg-[#090d16]/95 dark:bg-[#090d16]/95 border-t sm:border border-slate-700/80 shadow-[0_-15px_40px_rgba(0,0,0,0.85)] sm:shadow-[0_25px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl p-5 sm:p-3.5 text-foreground ring-1 ring-white/10 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in-95 duration-200 space-y-3"
          >
            {/* Mobile Drawer Pull Indicator */}
            <div className="sm:hidden flex justify-center pb-1">
              <div className="w-12 h-1.5 rounded-full bg-slate-600/80" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary-500/20 text-primary-400 border border-primary-500/30 flex items-center justify-center">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white tracking-tight">Download quality</h3>
                  <p className="text-[10px] text-slate-400">Default for lessons and course sections</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQualityDropdown(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dynamic Mode: Ask Each Time */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  handleUpdateQualitySetting('ask_each_time');
                  setShowQualityDropdown(false);
                }}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all duration-200 cursor-pointer group ${
                  !rememberQuality
                    ? 'bg-primary-950/70 border-primary-500/60 ring-1 ring-primary-500/30 shadow-md text-white'
                    : 'bg-slate-900/50 hover:bg-slate-800/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    !rememberQuality
                      ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">Ask each time</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-slate-800 text-slate-400 border border-slate-700">Dynamic</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">Prompt for resolution on each download</p>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  !rememberQuality
                    ? 'border-primary-400 bg-primary-500 text-white'
                    : 'border-slate-700'
                }`}>
                  {!rememberQuality && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
              </button>
            </div>

            {/* Preset Resolutions */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Preset Resolutions</p>

              {/* Full HD (1080p) */}
              <button
                type="button"
                onClick={() => {
                  handleUpdateQualitySetting('1080p');
                  setShowQualityDropdown(false);
                }}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all duration-200 cursor-pointer group ${
                  rememberQuality && preferredQuality === '1080p'
                    ? 'bg-primary-950/70 border-primary-500/60 ring-1 ring-primary-500/30 shadow-md text-white'
                    : 'bg-slate-900/50 hover:bg-slate-800/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    rememberQuality && preferredQuality === '1080p'
                      ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    <Tv className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">Full HD (1080p)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-purple-300 border border-purple-500/30">Crisp</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">~10–15 MB/lesson • Crisp maximum quality</p>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  rememberQuality && preferredQuality === '1080p'
                    ? 'border-primary-400 bg-primary-500 text-white'
                    : 'border-slate-700'
                }`}>
                  {rememberQuality && preferredQuality === '1080p' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
              </button>

              {/* High (720p) */}
              <button
                type="button"
                onClick={() => {
                  handleUpdateQualitySetting('720p');
                  setShowQualityDropdown(false);
                }}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all duration-200 cursor-pointer group ${
                  rememberQuality && preferredQuality === '720p'
                    ? 'bg-primary-950/70 border-primary-500/60 ring-1 ring-primary-500/30 shadow-md text-white'
                    : 'bg-slate-900/50 hover:bg-slate-800/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    rememberQuality && preferredQuality === '720p'
                      ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    <Film className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">High (720p)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-primary-500/20 text-primary-300 border border-primary-500/30">Recommended</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">~6–10 MB/lesson • Best speed & clarity</p>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  rememberQuality && preferredQuality === '720p'
                    ? 'border-primary-400 bg-primary-500 text-white'
                    : 'border-slate-700'
                }`}>
                  {rememberQuality && preferredQuality === '720p' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
              </button>

              {/* Medium (540p) */}
              <button
                type="button"
                onClick={() => {
                  handleUpdateQualitySetting('540p');
                  setShowQualityDropdown(false);
                }}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all duration-200 cursor-pointer group ${
                  rememberQuality && preferredQuality === '540p'
                    ? 'bg-primary-950/70 border-primary-500/60 ring-1 ring-primary-500/30 shadow-md text-white'
                    : 'bg-slate-900/50 hover:bg-slate-800/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    rememberQuality && preferredQuality === '540p'
                      ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">Medium (540p)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-slate-800 text-slate-300 border border-slate-700">Balanced</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">~6–9 MB/lesson • Balanced data & quality</p>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  rememberQuality && preferredQuality === '540p'
                    ? 'border-primary-400 bg-primary-500 text-white'
                    : 'border-slate-700'
                }`}>
                  {rememberQuality && preferredQuality === '540p' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
              </button>

              {/* Standard (360p) */}
              <button
                type="button"
                onClick={() => {
                  handleUpdateQualitySetting('360p');
                  setShowQualityDropdown(false);
                }}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all duration-200 cursor-pointer group ${
                  rememberQuality && preferredQuality === '360p'
                    ? 'bg-primary-950/70 border-primary-500/60 ring-1 ring-primary-500/30 shadow-md text-white'
                    : 'bg-slate-900/50 hover:bg-slate-800/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    rememberQuality && preferredQuality === '360p'
                      ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">Standard (360p)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-slate-800 text-slate-400 border border-slate-700">Data Saver</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">~3–5 MB/lesson • Fast on low bandwidth</p>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  rememberQuality && preferredQuality === '360p'
                    ? 'border-primary-400 bg-primary-500 text-white'
                    : 'border-slate-700'
                }`}>
                  {rememberQuality && preferredQuality === '360p' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
              </button>
            </div>

            {/* Footer Informational Callout */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2 leading-relaxed">
              <Info className="w-3.5 h-3.5 text-primary-400 shrink-0 mt-0.5" />
              <span>
                If your selected resolution is not available for a specific video, PrepTea will prompt you with the available options or automatically choose the closest quality.
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal for Clear All */}
      {confirmClearAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-card border border-card-border shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center border border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Clear all downloaded videos?</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                This will delete all {downloads.length} downloaded lessons from this browser ({formatBytes(storageUsage.usedBytes)}). You can re-download them anytime from your course batches.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmClearAll(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await clearAllDownloads();
                  setConfirmClearAll(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-md shadow-rose-600/30"
              >
                Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Course Delete */}
      {confirmCourseDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-card border border-card-border shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center border border-rose-500/30">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Delete downloads for {confirmCourseDelete.title}?
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                This will delete all {confirmCourseDelete.count} downloaded lessons belonging to this course from browser storage.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmCourseDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deleteCourseDownloads(confirmCourseDelete.slug);
                  setConfirmCourseDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-md shadow-rose-600/30"
              >
                Delete Course Downloads
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Section Delete */}
      {confirmSectionDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-card border border-card-border shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center border border-rose-500/30">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Delete section downloads?
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                This will remove all {confirmSectionDelete.count} downloaded lessons from section &quot;{confirmSectionDelete.sectionTitle}&quot; in {confirmSectionDelete.courseTitle}.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmSectionDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deleteSectionDownloads(
                    confirmSectionDelete.slug,
                    confirmSectionDelete.sectionTitle
                  );
                  setConfirmSectionDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-md shadow-rose-600/30"
              >
                Delete Section Downloads
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Page Cinema Player Modal with Next/Prev Controls */}
      {activePlaybackVideo && (
        <div 
          onClick={handleClosePlayer}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl lg:max-w-5xl rounded-3xl bg-card border border-card-border shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
          >
            {playbackLoading ? (
              <div className="w-full aspect-video flex flex-col items-center justify-center bg-black/95 text-center space-y-3 p-6">
                <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
                <p className="text-xs text-muted-foreground">Loading video stream from browser storage...</p>
              </div>
            ) : (
              <CustomVideoPlayer
                videoId={activePlaybackVideo.videoId}
                title={activePlaybackVideo.unitTitle}
                courseTitle={activePlaybackVideo.courseTitle}
                courseSlug={activePlaybackVideo.courseSlug}
                sectionTitle={activePlaybackVideo.sectionTitle}
                blobUrl={activePlaybackUrl || undefined}
                downloadedQuality={activePlaybackVideo.quality}
                onClose={handleClosePlayer}
                onNext={nextVideo ? handleSkipNext : undefined}
                onPrev={prevVideo ? handleSkipPrev : undefined}
                nextTitle={nextVideo?.unitTitle}
                prevTitle={prevVideo?.unitTitle}
              />
            )}
          </div>
        </div>
      )}

      {/* Search, Filter & View Controls */}
      {downloads.length > 0 && (
        <section aria-label="Search and Filter Downloads" className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by lesson, section, or course title..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-card border border-card-border text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-500/60 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View Mode & Sort Controls */}
            <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-card-border rounded-2xl px-3 py-1.5">
                <Filter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer text-xs"
                >
                  <option value="syllabus" className="bg-card text-foreground">Syllabus Order</option>
                  <option value="recent" className="bg-card text-foreground">Recently Saved</option>
                  <option value="title" className="bg-card text-foreground">Title (A-Z)</option>
                  <option value="size" className="bg-card text-foreground">Largest Size</option>
                </select>
              </div>

              {/* View Switcher: By Course vs All Videos */}
              <div className="flex items-center p-1 rounded-2xl bg-card border border-card-border">
                <button
                  onClick={() => setViewMode('courses')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'courses'
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Grouped by Course & Section"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>By Course</span>
                </button>
                <button
                  onClick={() => setViewMode('videos')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'videos'
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Flat Video Grid"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>All Videos</span>
                </button>
              </div>
            </div>
          </div>

          {/* Course Filter Pills */}
          {coursesList.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-1">
              <button
                onClick={() => setSelectedCourse('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCourse === 'all'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-card text-muted-foreground hover:text-foreground border border-card-border hover:border-slate-700'
                }`}
              >
                All Courses ({downloads.length})
              </button>
              {coursesList.map((course) => {
                const count = downloads.filter((d) => d.courseTitle === course).length;
                const isSelected = selectedCourse === course;
                return (
                  <button
                    key={course}
                    onClick={() => setSelectedCourse(course)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-card text-muted-foreground hover:text-foreground border border-card-border hover:border-slate-700'
                    }`}
                  >
                    {course} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Main Content Area */}
      {downloads.length === 0 ? (
        /* Normal Empty State */
        <div className="glass-panel rounded-3xl p-8 sm:p-14 border border-card-border text-center space-y-6 max-w-2xl mx-auto shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-emerald-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-500/10 to-emerald-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center mx-auto shadow-inner group-hover:scale-105 transition-transform duration-500 relative z-10">
            <Film className="w-12 h-12 drop-shadow-md" />
          </div>

          <div className="space-y-2 relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-br from-foreground via-foreground/90 to-primary-500/70 bg-clip-text text-transparent tracking-tight">No downloads yet</h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Download entire courses, sections, or individual lessons from your enrolled course batches. They will appear here ready for smooth offline playback without internet.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card/80 border border-card-border/80 backdrop-blur-sm max-w-md mx-auto text-left space-y-3 relative z-10 shadow-sm">
            <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary-500" />
              How in-site downloads work:
            </span>
            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
              <li>Click <span className="font-semibold text-foreground">Download Entire Course</span> to save all lessons at once.</li>
              <li>Or click <span className="font-semibold text-foreground">Download Section</span> for specific chapters.</li>
              <li>Videos are stored securely within your browser storage for high-speed offline playback.</li>
            </ul>
          </div>

          <div>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-primary-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <BookOpen className="w-4 h-4" />
              <span>Explore Courses</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : filteredDownloads.length === 0 ? (
        /* Filter Empty State */
        <div className="glass-panel rounded-3xl p-10 border border-card-border text-center space-y-3">
          <Search className="w-8 h-8 text-muted-foreground mx-auto" />
          <h3 className="text-base font-bold text-foreground">No matches found</h3>
          <p className="text-xs text-muted-foreground">
            No downloaded video lessons match your search criteria. Try a different search term or filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCourse('all');
            }}
            className="text-xs font-semibold text-primary-500 hover:underline pt-2 inline-block cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'courses' ? (
        /* Hierarchical Course & Section View */
        <div className="space-y-6">
          {groupedCourses.map((course) => {
            const firstVideo = course.sectionList[0]?.videos[0];

            return (
              <section
                key={course.courseSlug}
                className="glass-panel rounded-3xl border border-card-border/90 bg-card/85 shadow-lg overflow-hidden transition-all duration-300 space-y-4 hover:border-primary-500/40 hover:shadow-primary-950/20 group/course"
              >
                {/* Course Header Bar */}
                <div className="p-5 sm:p-6 pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover/course:bg-primary-500/10 transition-colors duration-500 pointer-events-none" />
                  
                  <div className="space-y-1 min-w-0 relative z-10">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Course Batch</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-foreground truncate group-hover/course:text-primary-400 transition-colors">
                      {course.courseTitle}
                    </h2>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium pt-0.5">
                      <span>{course.totalVideos} {course.totalVideos === 1 ? 'lesson' : 'lessons'}</span>
                      <span>•</span>
                      <span>{formatBytes(course.totalBytes)}</span>
                      {course.totalDurationSeconds > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(course.totalDurationSeconds)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Course Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {firstVideo && (
                      <button
                        onClick={() => handlePlayOffline(firstVideo)}
                        className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-md shadow-primary-600/20 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Play Course</span>
                      </button>
                    )}

                    {course.sectionList.length > 1 && (() => {
                      const isAnyCollapsed = course.sectionList.some(
                        (sec) => collapsedSections[`${course.courseSlug}_${sec.sectionTitle}`]
                      );
                      return (
                        <button
                          onClick={() => {
                            setCollapsedSections((prev) => {
                              const next = { ...prev };
                              const target = !isAnyCollapsed;
                              course.sectionList.forEach((sec) => {
                                next[`${course.courseSlug}_${sec.sectionTitle}`] = target;
                              });
                              return next;
                            });
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-muted-foreground hover:text-foreground font-semibold text-xs border border-slate-700/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                          title={isAnyCollapsed ? "Expand all sections" : "Collapse all sections"}
                        >
                          {isAnyCollapsed ? (
                            <>
                              <FolderOpen className="w-3.5 h-3.5 text-primary-400" />
                              <span className="hidden sm:inline">Expand All</span>
                            </>
                          ) : (
                            <>
                              <Folder className="w-3.5 h-3.5 text-slate-400" />
                              <span className="hidden sm:inline">Collapse All</span>
                            </>
                          )}
                        </button>
                      );
                    })()}

                    <Link
                      href={`/courses/${course.courseSlug}`}
                      className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-foreground font-semibold text-xs border border-slate-700/60 transition-colors"
                      title="Open full course page"
                    >
                      Course Details
                    </Link>

                    <button
                      onClick={() =>
                        setConfirmCourseDelete({
                          slug: course.courseSlug,
                          title: course.courseTitle,
                          count: course.totalVideos,
                        })
                      }
                      className="p-2 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                      title="Delete all downloads for this course"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Course Sections */}
                <div className="px-4 sm:px-6 pb-6 space-y-3">
                  {course.sectionList.map((sec, secIdx) => {
                    if (!sec.videos || sec.videos.length === 0) return null;
                    const sectionKey = `${course.courseSlug}_${sec.sectionTitle}`;
                    const isCollapsed = collapsedSections[sectionKey];

                    return (
                      <div
                        key={sec.sectionTitle}
                        className="rounded-2xl border border-card-border/70 bg-card/50 overflow-hidden transition-all"
                      >
                        {/* Section Header Accordion Toggle */}
                        <div
                          onClick={() => toggleSectionCollapse(sectionKey)}
                          className="p-3.5 sm:p-4 flex items-center justify-between gap-3 bg-background/50 hover:bg-background/80 transition-colors cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-500 text-xs font-bold shrink-0">
                              {secIdx + 1}
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                              {sec.sectionTitle}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                              ({sec.videos.length} {sec.videos.length === 1 ? 'lesson' : 'lessons'} • {formatBytes(sec.totalBytes)})
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmSectionDelete({
                                  slug: course.courseSlug,
                                  courseTitle: course.courseTitle,
                                  sectionTitle: sec.sectionTitle,
                                  count: sec.videos.length,
                                });
                              }}
                              className="p-1 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                              title="Delete all downloads in this section"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="text-muted-foreground">
                              {isCollapsed ? (
                                <ChevronRight className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Section Lessons List */}
                        {!isCollapsed && (
                          <div className="p-3 sm:p-4 space-y-2 border-t border-card-border/60">
                            {sec.videos.map((video, vIdx) => {
                              const isCurrentlyPlaying = activePlaybackVideo?.videoId === video.videoId;
                              return (
                                <article
                                  key={video.videoId}
                                  className={`group p-2.5 sm:p-3 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                                    isCurrentlyPlaying
                                      ? 'bg-primary-950/40 border border-primary-500/60 ring-1 ring-primary-500/30 shadow-md shadow-primary-950/20'
                                      : 'bg-card hover:bg-slate-800/50 border border-card-border/60 hover:border-primary-500/30'
                                  }`}
                                >
                                  {/* Thumbnail + Title */}
                                  <div
                                    onClick={() => handlePlayOffline(video)}
                                    className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                                  >
                                    {/* Small Thumbnail */}
                                    <div className="relative w-24 sm:w-28 aspect-video rounded-lg overflow-hidden bg-slate-900 shrink-0 group-hover:scale-105 transition-transform duration-300">
                                      {video.thumbnailUrl ? (
                                        <img
                                          src={video.thumbnailUrl}
                                          alt={video.unitTitle}
                                          className="w-full h-full object-cover"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500">
                                          <Film className="w-5 h-5" />
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Play className="w-4 h-4 text-white fill-current" />
                                      </div>
                                      {video.durationSeconds > 0 && (
                                        <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 text-[9px] font-mono font-bold text-white">
                                          {formatDuration(video.durationSeconds)}
                                        </span>
                                      )}
                                    </div>

                                    {/* Lesson Info */}
                                    <div className="min-w-0 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-md bg-white/[0.05] border border-white/[0.08] text-[10px] font-mono font-bold text-muted-foreground flex items-center justify-center shrink-0">
                                          {vIdx + 1}
                                        </span>
                                        <h4 className="text-xs sm:text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary-500 transition-colors">
                                          {video.unitTitle}
                                        </h4>
                                        {isCurrentlyPlaying && (
                                          <span className="px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-300 font-bold text-[9px] uppercase border border-primary-500/30 shrink-0 animate-pulse">
                                            Now Playing
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-muted-foreground font-medium flex-wrap">
                                        <span className="px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-400 font-semibold border border-primary-500/20">
                                          {video.quality}
                                        </span>
                                        {video.durationSeconds > 0 && (
                                          <span>{formatDuration(video.durationSeconds)}</span>
                                        )}
                                        <span>•</span>
                                        <span>{formatBytes(video.sizeBytes)}</span>
                                        <span>•</span>
                                        <span>{formatDate(video.downloadedAt)}</span>
                                      </div>
                                    </div>
                                  </div>

                                {/* Lesson Actions */}
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  <button
                                    onClick={() => handlePlayOffline(video)}
                                    className="px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                                  >
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                    <span>Watch</span>
                                  </button>

                                  <Link
                                    href={`/courses/${video.courseSlug}/video/${video.videoId}`}
                                    className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-muted-foreground hover:text-foreground border border-slate-700/60 transition-colors"
                                    title="Open full lesson page"
                                  >
                                    <BookOpen className="w-3.5 h-3.5" />
                                  </Link>

                                  {deletingId === video.videoId ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={(e) => handleDeleteItem(e, video.videoId)}
                                        className="px-2 py-1 rounded-xl bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                                        title="Confirm Delete"
                                      >
                                        Delete
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeletingId(null);
                                        }}
                                        className="p-1 rounded-xl hover:bg-white/10 text-muted-foreground cursor-pointer"
                                        title="Cancel"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingId(video.videoId);
                                      }}
                                      className="p-1.5 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                                      title="Delete lesson"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </article>
                            )})}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* Flat Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredDownloads.map((video) => {
            const isCurrentlyPlaying = activePlaybackVideo?.videoId === video.videoId;
            return (
              <article
                key={video.videoId}
                className={`group glass-panel rounded-2xl sm:rounded-3xl transition-all duration-300 flex flex-col overflow-hidden ${
                  isCurrentlyPlaying
                    ? 'border-2 border-primary-500 bg-card shadow-xl shadow-primary-950/30 ring-2 ring-primary-500/20'
                    : 'border border-card-border/80 hover:border-primary-500/40 bg-card/80 hover:bg-card shadow-md hover:shadow-xl hover:shadow-primary-950/20'
                }`}
              >
                {/* Thumbnail Area with Play Action */}
                <div 
                  onClick={() => handlePlayOffline(video)}
                  className="relative aspect-video w-full bg-slate-900 overflow-hidden cursor-pointer group/thumb"
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.unitTitle}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 text-slate-500 p-4 text-center">
                      <Film className="w-8 h-8 mb-1 text-slate-600" />
                      <span className="text-[10px] font-bold line-clamp-2">{video.unitTitle}</span>
                    </div>
                  )}

                  {/* Dark Hover Tint */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary-600/90 text-white flex items-center justify-center shadow-xl transform scale-90 group-hover/thumb:scale-100 transition-transform">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </div>

                  {/* Duration Badge */}
                  {video.durationSeconds > 0 && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/10">
                      {formatDuration(video.durationSeconds)}
                    </div>
                  )}

                  {/* Downloaded Check Badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/85 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold backdrop-blur-md shadow-sm">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Saved</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-primary-600 dark:text-primary-400 line-clamp-1">
                        {video.courseTitle}
                      </span>
                      {video.sectionTitle && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="text-[10px] font-medium text-muted-foreground line-clamp-1">
                            {video.sectionTitle}
                          </span>
                        </>
                      )}
                      {isCurrentlyPlaying && (
                        <span className="px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-300 font-bold text-[9px] uppercase border border-primary-500/30 shrink-0 animate-pulse ml-auto">
                          Now Playing
                        </span>
                      )}
                    </div>
                  <h3 
                    onClick={() => handlePlayOffline(video)}
                    className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-primary-500 transition-colors cursor-pointer"
                    title={video.unitTitle}
                  >
                    {video.unitTitle}
                  </h3>
                </div>

                {/* Metadata Row */}
                <div className="space-y-3 pt-2 border-t border-card-border/60">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold px-1.5 py-0.5 rounded bg-card-border/60 text-foreground text-[10px]">
                        {video.quality}
                      </span>
                      <span>{formatBytes(video.sizeBytes)}</span>
                    </div>
                    <span>{formatDate(video.downloadedAt)}</span>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePlayOffline(video)}
                      className="flex-1 py-2 px-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-primary-600/20 active:scale-95 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Watch Offline</span>
                    </button>

                    <Link
                      href={`/courses/${video.courseSlug}/video/${video.videoId}`}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-muted-foreground hover:text-foreground border border-slate-700/60 transition-colors"
                      title="Open full course lesson page"
                    >
                      <BookOpen className="w-4 h-4" />
                    </Link>

                    {deletingId === video.videoId ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleDeleteItem(e, video.videoId)}
                          className="px-2 py-1.5 rounded-xl bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                          title="Confirm Delete"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(null);
                          }}
                          className="p-1.5 rounded-xl hover:bg-white/10 text-muted-foreground cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(video.videoId);
                        }}
                        className="p-2 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                        title="Delete download from device"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        </div>
      )}
    </main>
  );
}
