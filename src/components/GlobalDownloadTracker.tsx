'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  Pause,
  Play,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  FolderOpen,
  WifiOff,
  Layers,
  Sparkles,
  Settings,
} from 'lucide-react';
import { useDownloads, DownloadingStatus } from '@/lib/downloadContext';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec < 1024 * 1024) {
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatEta(seconds?: number): string {
  if (seconds === undefined || seconds <= 0 || !isFinite(seconds)) return '';
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s left`;
  }
  const mins = Math.floor(seconds / 60);
  const remSecs = Math.ceil(seconds % 60);
  return `${mins}m ${remSecs > 0 ? `${remSecs}s ` : ''}left`;
}

export function GlobalDownloadTracker() {
  const {
    downloadingMap,
    batchProgress,
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    pauseAllDownloads,
    resumeAllDownloads,
    cancelBatchDownload,
  } = useDownloads();

  const [isMinimized, setIsMinimized] = useState<boolean>(true);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [showQueueList, setShowQueueList] = useState<boolean>(false);
  const [completedNotice, setCompletedNotice] = useState<{
    title: string;
    courseTitle?: string;
    timestamp: number;
  } | null>(null);

  // Keep track of previously active downloads to detect completion
  const prevActiveCountRef = useRef<number>(0);
  const lastActiveItemRef = useRef<{ title: string; courseTitle?: string } | null>(null);

  // Active items list: downloading, paused, queued
  const activeEntries = useMemo(() => {
    return Object.entries(downloadingMap).filter(
      ([_, status]) =>
        status.status === 'downloading' ||
        status.status === 'paused' ||
        status.status === 'queued'
    );
  }, [downloadingMap]);

  // Find currently downloading or active item
  const currentItemEntry = useMemo(() => {
    if (activeEntries.length === 0) return null;
    return (
      activeEntries.find(([_, item]) => item.status === 'downloading') ||
      activeEntries.find(([_, item]) => item.status === 'paused') ||
      activeEntries[0]
    );
  }, [activeEntries]);

  // Detect completion transition
  useEffect(() => {
    const currentCount = activeEntries.length;

    if (currentItemEntry) {
      lastActiveItemRef.current = {
        title: currentItemEntry[1].unitTitle || 'Video',
        courseTitle: currentItemEntry[1].courseTitle,
      };
      // If a new download started, re-show if was dismissed and open in pill mode by default
      if (prevActiveCountRef.current === 0 && currentCount > 0) {
        setIsDismissed(false);
        setIsMinimized(true);
      }
    } else if (prevActiveCountRef.current > 0 && currentCount === 0) {
      // Just transitioned from having active downloads to 0 active downloads -> Completed!
      if (lastActiveItemRef.current) {
        setCompletedNotice({
          title: lastActiveItemRef.current.title,
          courseTitle: lastActiveItemRef.current.courseTitle,
          timestamp: Date.now(),
        });
      }
    }

    prevActiveCountRef.current = currentCount;
  }, [activeEntries.length, currentItemEntry]);

  // Auto-dismiss completed notification after 4.5 seconds
  useEffect(() => {
    if (!completedNotice) return;
    const timer = setTimeout(() => {
      setCompletedNotice(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [completedNotice]);

  // If dismissed or nothing to show
  if (isDismissed && !completedNotice) return null;
  if (activeEntries.length === 0 && !completedNotice) return null;

  // --- COMPLETED STATE VIEW ---
  if (activeEntries.length === 0 && completedNotice) {
    return (
      <aside
        aria-label="Download finished notification"
        className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
      >
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0f172a]/95 border border-emerald-500/40 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
              <CheckCircle2 className="w-5 h-5 animate-bounce-short" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Download Complete
                </span>
              </div>
              <p className="text-sm font-semibold text-white truncate">
                {completedNotice.title}
              </p>
              {completedNotice.courseTitle && (
                <p className="text-[11px] text-slate-400 truncate">
                  {completedNotice.courseTitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href="/downloads"
              onClick={() => setCompletedNotice(null)}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 text-xs font-bold transition-all duration-200"
            >
              View
            </Link>
            <button
              onClick={() => setCompletedNotice(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  if (!currentItemEntry) return null;

  const [activeVideoId, currentItem] = currentItemEntry;
  const isPaused = currentItem.status === 'paused';
  const isQueued = currentItem.status === 'queued';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const progressPercent = Math.min(100, Math.max(0, Math.round(currentItem.progress || 0)));
  const otherQueuedCount = Math.max(0, activeEntries.length - 1);

  // SVG Circle dimensions for minimized view
  const circleRadius = 14;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // --- MINIMIZED FLOATING PILL VIEW (YOUTUBE STYLE) ---
  if (isMinimized) {
    return (
      <aside
        aria-label="Background download progress pill"
        className="fixed bottom-20 right-3 sm:bottom-6 sm:right-6 z-50 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
      >
        <div
          onClick={() => setIsMinimized(false)}
          className="cursor-pointer group flex items-center gap-2.5 px-3 py-2 rounded-full bg-[#0f172a]/95 border border-primary-500/40 shadow-2xl shadow-primary-950/60 backdrop-blur-xl text-white hover:border-primary-400 transition-all duration-200 hover:scale-[1.02]"
        >
          {/* Circular SVG Progress */}
          <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r={circleRadius}
                className="stroke-slate-700/60"
                strokeWidth="3.5"
                fill="none"
              />
              <circle
                cx="18"
                cy="18"
                r={circleRadius}
                className={isPaused ? 'stroke-amber-400' : 'stroke-primary-500'}
                strokeWidth="3.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                style={{ transition: 'stroke-dashoffset 0.3s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black tracking-tighter">
              {isPaused ? (
                <Pause className="w-3 h-3 text-amber-400" />
              ) : (
                `${progressPercent}%`
              )}
            </div>
          </div>

          {/* Quick Info */}
          <div className="max-w-[140px] sm:max-w-[180px] min-w-0 pr-1">
            <p className="text-xs font-semibold text-white truncate leading-tight">
              {currentItem.unitTitle || 'Downloading video'}
            </p>
            <p className="text-[10px] text-slate-400 truncate leading-tight">
              {isPaused ? (
                <span className="text-amber-400 font-medium">Paused</span>
              ) : (
                <span>
                  {formatSpeed(currentItem.speedBytesPerSec)}
                  {otherQueuedCount > 0 ? ` • +${otherQueuedCount} queued` : ''}
                </span>
              )}
            </p>
          </div>

          {/* Quick Pause / Resume Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isPaused) {
                resumeDownload(activeVideoId);
              } else {
                pauseDownload(activeVideoId);
              }
            }}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 transition-colors"
            title={isPaused ? 'Resume download' : 'Pause download'}
            aria-label={isPaused ? 'Resume download' : 'Pause download'}
          >
            {isPaused ? (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5 text-primary-400" />
            ) : (
              <Pause className="w-3.5 h-3.5 fill-current" />
            )}
          </button>

          {/* Expand Icon */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(false);
            }}
            className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            title="Expand download card"
            aria-label="Expand download card"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  // --- EXPANDED CARD VIEW (FULL YOUTUBE STYLE DOCKED WIDGET) ---
  return (
    <aside
      aria-label="Background download active tracker"
      className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
    >
      <div className="rounded-2xl bg-[#0f172a]/95 border border-slate-700/80 shadow-2xl shadow-primary-950/70 backdrop-blur-xl text-foreground overflow-hidden ring-1 ring-white/10">
        
        {/* Header Bar */}
        <div className="px-3.5 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isPaused 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                : 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
            }`}>
              {isPaused ? (
                <Pause className="w-3.5 h-3.5" />
              ) : isOffline ? (
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <ArrowDownToLine className="w-3.5 h-3.5 animate-pulse" />
              )}
            </div>

            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 truncate">
              {batchProgress
                ? `Batch Download (${batchProgress.completedItems}/${batchProgress.totalItems})`
                : isPaused
                ? 'Download Paused'
                : isQueued
                ? 'Queued'
                : 'Downloading'}
            </span>

            {currentItem.quality && (
              <Link
                href="/downloads#download-settings"
                title="Change download quality settings"
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-primary-500/40 transition-colors"
              >
                <span>{currentItem.quality}</span>
                <Settings className="w-2.5 h-2.5 text-slate-400" />
              </Link>
            )}
          </div>

          {/* Header Action Icons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Minimize to pill"
              aria-label="Minimize download tracker"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Hide tracker (download continues in background)"
              aria-label="Hide download tracker"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3.5 space-y-3">
          {/* Video Title & Subtitle */}
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-white truncate leading-snug">
              {currentItem.unitTitle || 'Video Lesson'}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate mt-0.5">
              {currentItem.courseTitle && (
                <span className="truncate">{currentItem.courseTitle}</span>
              )}
              {currentItem.sectionTitle && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="truncate">{currentItem.sectionTitle}</span>
                </>
              )}
            </div>
          </div>

          {/* Notice if preferred quality was not available for this video */}
          {currentItem.qualityFallbackNotice && currentItem.qualityFallbackNotice.requestedQuality !== currentItem.qualityFallbackNotice.actualQuality && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <span className="font-bold text-amber-200">
                    {currentItem.qualityFallbackNotice.requestedQuality} is not available
                  </span>
                  <span className="text-amber-300/90 block sm:inline sm:ml-1">
                    for this lesson. PrepTea selected {currentItem.qualityFallbackNotice.actualQuality}.
                  </span>
                </div>
              </div>

              {currentItem.qualityFallbackNotice.availableQualities && currentItem.qualityFallbackNotice.availableQualities.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-amber-500/20">
                  <span className="text-[10px] text-amber-400 font-semibold">Available:</span>
                  {currentItem.qualityFallbackNotice.availableQualities.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        // Switch to this available quality
                        startDownload({
                          videoId: activeVideoId,
                          courseSlug: currentItem.courseSlug || '',
                          courseTitle: currentItem.courseTitle || '',
                          sectionTitle: currentItem.sectionTitle || '',
                          sectionId: currentItem.sectionId,
                          unitTitle: currentItem.unitTitle || 'Video',
                          thumbnailUrl: currentItem.thumbnailUrl,
                          durationSeconds: currentItem.durationSeconds || 0,
                          quality: q,
                        });
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold transition-colors cursor-pointer ${
                        currentItem.quality === q
                          ? 'bg-amber-500 text-black'
                          : 'bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 border border-amber-500/30'
                      }`}
                      title={`Download in ${q}`}
                    >
                      {q} {currentItem.quality === q ? '✓' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Progress Bar Container */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white text-[13px]">
                {progressPercent}%
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {formatBytes(currentItem.bytesReceived)} / {formatBytes(currentItem.totalBytes)}
              </span>
            </div>

            {/* Glowing Linear Progress Bar */}
            <div className="relative w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isPaused
                    ? 'bg-amber-400'
                    : 'bg-gradient-to-r from-primary-600 via-primary-500 to-cyan-400 shadow-[0_0_12px_rgba(99,102,241,0.5)]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Speed & ETA Row */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span>
                {isPaused ? (
                  <span className="text-amber-400 font-medium">
                    {currentItem.error || 'Paused'}
                  </span>
                ) : isOffline ? (
                  <span className="text-amber-400 font-medium">Waiting for network...</span>
                ) : (
                  formatSpeed(currentItem.speedBytesPerSec)
                )}
              </span>
              <span>
                {!isPaused && !isOffline && formatEta(currentItem.etaSeconds)}
              </span>
            </div>
          </div>

          {/* Control Buttons Row */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5">
              {/* Pause / Resume Button */}
              <button
                onClick={() => {
                  if (isPaused) {
                    resumeDownload(activeVideoId);
                  } else {
                    pauseDownload(activeVideoId);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  isPaused
                    ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-md shadow-primary-900/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
                }`}
              >
                {isPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </>
                )}
              </button>

              {/* Cancel Button */}
              <button
                onClick={() => {
                  if (batchProgress) {
                    cancelBatchDownload();
                  } else {
                    cancelDownload(activeVideoId);
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800 text-xs font-medium transition-all duration-200"
                title="Cancel download"
              >
                Cancel
              </button>
            </div>

            {/* Go to Downloads Link */}
            <Link
              href="/downloads"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-primary-400 hover:text-primary-300 hover:bg-primary-950/40 border border-transparent hover:border-primary-500/30 transition-all duration-200"
            >
              <span>All Downloads</span>
              <FolderOpen className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Multiple Queued Items Indicator */}
          {otherQueuedCount > 0 && (
            <div className="pt-1 border-t border-slate-800/60">
              <button
                onClick={() => setShowQueueList(!showQueueList)}
                className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 transition-colors py-0.5"
              >
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary-400" />
                  <span>
                    <strong>{otherQueuedCount}</strong> more item{otherQueuedCount > 1 ? 's' : ''} in queue
                  </span>
                </div>
                {showQueueList ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Collapsible Queued Items List */}
              {showQueueList && (
                <div className="mt-2 space-y-1 max-h-28 overflow-y-auto pr-1 text-xs">
                  {activeEntries
                    .filter(([id]) => id !== activeVideoId)
                    .map(([id, item]) => (
                      <div
                        key={id}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-300"
                      >
                        <span className="truncate pr-2 text-[11px]">
                          {item.unitTitle || 'Video'}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.status}
                          </span>
                          <button
                            onClick={() => cancelDownload(id)}
                            className="p-0.5 hover:text-rose-400 transition-colors"
                            title="Remove from queue"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
