'use client';

import React, { useState, useEffect, useRef,useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  X,
  Trash2,
  ArrowUpRight,
  Sparkles,
  Clock,
  HardDrive,
  Settings,
  ChevronDown,
  Sliders,
  Check,
  Crown,
} from 'lucide-react';
import { useDownloads, StartDownloadParams } from '@/lib/downloadContext';
import { useAuth } from '@/lib/authContext';
import { checkCanDownload } from '@/lib/batchAccess';
import { findBestMatchingAsset, getRememberedQuality, saveRememberedQuality } from '@/lib/qualityMatcher';

interface VideoAssetOption {
  slug: string;
  displayName: string;
  height: number;
  sizeBytes: number;
  url?: string;
}

const DEFAULT_QUALITIES: VideoAssetOption[] = [
  { slug: '1080p', displayName: '1080p', height: 1080, sizeBytes: 17.2 * 1024 * 1024 },
  { slug: '720p', displayName: '720p', height: 720, sizeBytes: 10.1 * 1024 * 1024 },
  { slug: '540p', displayName: '540p', height: 540, sizeBytes: 7.2 * 1024 * 1024 },
  { slug: '360p', displayName: '360p', height: 360, sizeBytes: 4.8 * 1024 * 1024 },
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export interface YouTubeDownloadButtonProps {
  videoId: string;
  courseSlug: string;
  courseTitle: string;
  sectionTitle?: string;
  sectionId?: string;
  unitTitle: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  availableAssets?: VideoAssetOption[];
  className?: string;
}

export function YouTubeDownloadButton({
  videoId,
  courseSlug,
  courseTitle,
  sectionTitle,
  sectionId,
  unitTitle,
  thumbnailUrl = '',
  durationSeconds = 0,
  availableAssets,
  className = '',
}: YouTubeDownloadButtonProps) {
  const {
    isDownloaded,
    getDownloadStatus,
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteDownload,
    downloads,
  } = useDownloads();
  const { user } = useAuth();
  const canDownload = checkCanDownload(user);

  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showActiveMenu, setShowActiveMenu] = useState(false);
  const [showDownloadedMenu, setShowDownloadedMenu] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string>('720p');
  const [rememberPreference, setRememberPreference] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const downloaded = isDownloaded(videoId);
  const downloadRecord = downloads.find((d) => d.videoId === videoId);
  const statusObj = getDownloadStatus(videoId);
  const status = statusObj?.status; // 'queued' | 'downloading' | 'paused' | 'failed'

  const qualityOptions = useMemo(() => {
    const raw = (availableAssets && availableAssets.length > 0) ? availableAssets : DEFAULT_QUALITIES;
    // Strictly restrict download options to 4 qualities: 1080, 720, 540, 360
    const filtered = raw.filter((a) => [1080, 720, 540, 360].includes(a.height || 0));
    return filtered.length > 0 ? filtered : DEFAULT_QUALITIES;
  }, [availableAssets]);

  // Load remember preference on mount
  useEffect(() => {
    try {
      const remembered = localStorage.getItem('preptea_remember_download_quality');
      const targetPref = getRememberedQuality('720p');
      if (remembered === 'true') {
        setRememberPreference(true);
      } else {
        setRememberPreference(false);
      }
      const best = findBestMatchingAsset(qualityOptions, targetPref);
      if (best) {
        setSelectedSlug(best.slug);
      }
    } catch {
      // ignore
    }
  }, [qualityOptions]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowActiveMenu(false);
        setShowDownloadedMenu(false);
        setShowQualityModal(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleButtonClick = () => {
    if (!canDownload) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('preptea:premium-download-required'));
      }
      return;
    }

    if (downloaded) {
      setShowDownloadedMenu((prev) => !prev);
      return;
    }

    if (status === 'downloading' || status === 'queued' || status === 'paused') {
      setShowActiveMenu((prev) => !prev);
      return;
    }

    // Not downloaded & not downloading:
    // Check if user has "Remember my settings" turned on (like YouTube)
    if (rememberPreference) {
      // Intelligently find best matching asset: exact -> best higher -> best available
      const chosen = findBestMatchingAsset(qualityOptions, selectedSlug) || qualityOptions[0];
      startDownload({
        videoId,
        courseSlug,
        courseTitle,
        sectionTitle,
        sectionId,
        unitTitle,
        thumbnailUrl,
        durationSeconds,
        quality: chosen.displayName || `${chosen.height}p`,
        assetUrl: chosen.url,
        expectedSizeBytes: chosen.sizeBytes,
      });
      return;
    }

    // Open YouTube-style resolution picker with 720p default selected
    const best720 = findBestMatchingAsset(qualityOptions, '720p');
    if (best720) setSelectedSlug(best720.slug);
    setShowQualityModal(true);
  };

  const handleConfirmDownload = () => {
    // Intelligently find best matching asset for chosen selection
    const chosen = findBestMatchingAsset(qualityOptions, selectedSlug) || qualityOptions[0];

    try {
      saveRememberedQuality(chosen.height);
      if (rememberPreference) {
        localStorage.setItem('preptea_remember_download_quality', 'true');
      } else {
        localStorage.removeItem('preptea_remember_download_quality');
      }
    } catch {
      // ignore
    }

    setShowQualityModal(false);

    startDownload({
      videoId,
      courseSlug,
      courseTitle,
      sectionTitle,
      sectionId,
      unitTitle,
      thumbnailUrl,
      durationSeconds,
      quality: chosen.displayName || `${chosen.height}p`,
      assetUrl: chosen.url,
      expectedSizeBytes: chosen.sizeBytes,
    });
  };

  // Circular progress calculations for YouTube-style progress ring
  const progressPercent = statusObj?.progress || 0;
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;


  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* =========================================================================
          MAIN ACTION PILL BUTTON (YOUTUBE STYLE)
         ========================================================================= */}
      {downloaded ? (
        /* State 1: COMPLETED (DOWNLOADED) */
        <button
          type="button"
          onClick={handleButtonClick}
          className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-primary-950/90 border border-primary-500/40 text-primary-400 hover:text-primary-300 text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer touch-manipulation group"
          title={`Downloaded (${downloadRecord?.quality || 'HD'}) — Click for options`}
        >
          <CheckCircle2 className="w-4 h-4 text-primary-400 group-hover:scale-110 transition-transform" />
          <span>Downloaded</span>
        </button>
      ) : status === 'downloading' ? (
        /* State 2: DOWNLOADING (CIRCULAR PROGRESS RING) */
        <button
          type="button"
          onClick={handleButtonClick}
          className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-primary-950/90 border border-primary-500/50 text-primary-300 text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer touch-manipulation"
          title={`Downloading: ${progressPercent}% — Click to pause or cancel`}
        >
          {/* Circular SVG Ring */}
          <div className="relative w-4.5 h-4.5 flex items-center justify-center">
            <svg className="w-4.5 h-4.5 -rotate-90" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r={radius}
                className="stroke-primary-950/60"
                strokeWidth="2.5"
                fill="none"
              />
              <circle
                cx="12"
                cy="12"
                r={radius}
                className="stroke-primary-400 transition-all duration-300"
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
          <span>{`${progressPercent}%`}</span>
        </button>
      ) : status === 'queued' ? (
        /* State 3: QUEUED (WAITING IN QUEUE) */
        <button
          type="button"
          onClick={handleButtonClick}
          className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-slate-800/90 border border-amber-500/30 text-amber-300 text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer touch-manipulation"
          title="Waiting in download queue — Click for options"
        >
          <Clock className="w-3.5 h-3.5 animate-pulse text-amber-400" />
          <span>Queued</span>
        </button>
      ) : status === 'paused' ? (
        /* State 4: PAUSED */
        <button
          type="button"
          onClick={handleButtonClick}
          className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-muted-foreground hover:text-foreground text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer touch-manipulation"
          title={`Paused at ${progressPercent}% — Click to resume`}
        >
          <Pause className="w-3.5 h-3.5 fill-current text-slate-400" />
          <span>Paused {progressPercent > 0 ? `${progressPercent}%` : ''}</span>
        </button>
      ) : (
        /* State 5: NOT DOWNLOADED (PROFESSIONAL YOUTUBE SPLIT BUTTON) */
        <div className={`inline-flex items-center rounded-xl bg-slate-800/90 border ${!canDownload ? 'border-amber-500/40 hover:border-amber-400/70' : 'border-slate-700/60 hover:border-primary-500/40'} transition-all shadow-sm group`}>
          <button
            type="button"
            onClick={handleButtonClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-foreground text-xs font-bold transition-all active:scale-95 touch-manipulation cursor-pointer ${!canDownload ? 'hover:text-amber-300' : 'hover:text-primary-300'}`}
            title={canDownload ? (rememberPreference ? `Download in ${selectedSlug} (Click to download)` : "Download lesson") : "Offline Download (Premium Feature — Click to unlock)"}
          >
            <ArrowDownToLine className={`w-4 h-4 ${!canDownload ? 'text-amber-400' : 'text-primary-400'} group-hover:-translate-y-0.5 transition-transform`} />
            <span>Download</span>
            {!canDownload && (
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shadow-sm">
                <Crown className="w-2.5 h-2.5 text-amber-400" />
                <span>Premium</span>
              </span>
            )}
            {canDownload && rememberPreference && (
              <span className="text-[10px] font-mono font-normal text-muted-foreground bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                {selectedSlug}
              </span>
            )}
          </button>
          {canDownload && rememberPreference && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!canDownload) {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('preptea:premium-download-required'));
                  }
                  return;
                }
                setShowQualityModal(true);
              }}
              className="px-1.5 py-1.5 sm:py-2 border-l border-slate-700/60 text-muted-foreground hover:text-foreground hover:bg-slate-700/50 rounded-r-xl transition-colors cursor-pointer"
              title="Change quality or switch back to Ask Each Time"
              aria-label="Change download quality settings"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* =========================================================================
          YOUTUBE QUALITY PICKER MODAL
         ========================================================================= */}
      {showQualityModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 bottom-full mb-2 z-50 w-72 sm:w-84 p-4 rounded-3xl bg-slate-900/95 border border-slate-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl animate-in fade-in zoom-in-95 space-y-3.5 text-foreground select-none ring-1 ring-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-400">
                <ArrowDownToLine className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block leading-tight">Download quality</span>
                <span className="text-[10px] text-slate-400">Choose playback resolution</span>
              </div>
            </div>
            <button
              onClick={() => setShowQualityModal(false)}
              className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Resolutions List with Modern Card Aesthetics */}
          <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-0.5">
            {qualityOptions.map((opt) => {
              const isSelected = selectedSlug === opt.slug;
              const sizeFormatted = opt.sizeBytes ? formatBytes(opt.sizeBytes) : '~10 MB';
              const isHD = opt.height >= 720;
              const isFullHD = opt.height >= 1080;

              return (
                <button
                  key={opt.slug}
                  type="button"
                  onClick={() => setSelectedSlug(opt.slug)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-primary-950/80 to-slate-900 border border-primary-500/60 text-white shadow-md shadow-primary-950/50 ring-1 ring-primary-500/30'
                      : 'hover:bg-slate-800/60 border border-transparent text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'border-primary-400 bg-primary-500 text-white' : 'border-slate-600'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-bold text-white">{opt.displayName || `${opt.height}p`}</span>
                      {isFullHD ? (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-purple-300 border border-purple-500/30">
                          1080p Full HD
                        </span>
                      ) : isHD ? (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                          HD
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">{sizeFormatted}</span>
                </button>
              );
            })}
          </div>

          {/* YouTube-style "Remember my settings" checkbox & reset */}
          <div className="pt-2 border-t border-card-border/60 space-y-1.5">
            <label className="flex items-center justify-between gap-2 cursor-pointer group">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberPreference}
                  onChange={(e) => setRememberPreference(e.target.checked)}
                  className="rounded border-slate-600 text-primary-500 focus:ring-0 focus:outline-hidden w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-[11px] font-semibold text-foreground group-hover:text-primary-300 transition-colors select-none">
                  Remember my download settings
                </span>
              </div>
              <Link
                href="/downloads#download-settings"
                onClick={() => setShowQualityModal(false)}
                className="text-[10px] text-muted-foreground hover:text-primary-400 flex items-center gap-1 transition-colors"
                title="Manage download preferences"
              >
                <Settings className="w-2.5 h-2.5" />
                <span>Settings</span>
              </Link>
            </label>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {rememberPreference
                ? 'Future downloads will start automatically in this resolution without prompting.'
                : 'Unchecked: PrepTea will ask you to choose resolution every time.'}
            </p>
          </div>

          {/* Confirm Button */}
          <div className="pt-1 flex items-center gap-2">
            {rememberPreference && (
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem('preptea_remember_download_quality');
                  } catch {}
                  setRememberPreference(false);
                }}
                className="px-2.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                title="Switch back to Ask Each Time"
              >
                Ask Each Time
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirmDownload}
              className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold shadow-md shadow-primary-600/30 transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          ACTIVE DOWNLOAD POPOVER (DOWNLOADING / QUEUED / PAUSED)
         ========================================================================= */}
      {showActiveMenu && statusObj && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 bottom-full mb-2 z-50 w-64 p-3 rounded-2xl bg-card/95 border border-card-border shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 space-y-2.5 text-foreground select-none"
        >
          <div className="flex items-center justify-between pb-2 border-b border-card-border/60">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              {status === 'downloading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-400" />}
              {status === 'queued' && <Clock className="w-3.5 h-3.5 text-amber-400" />}
              {status === 'paused' && <Pause className="w-3.5 h-3.5 text-slate-400" />}
              <span className="capitalize">{status === 'queued' ? 'Waiting in Queue' : status}</span>
            </div>
            <button
              onClick={() => setShowActiveMenu(false)}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-foreground line-clamp-1">{unitTitle}</p>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{statusObj.quality || '720p'}</span>
              <span>
                {formatBytes(statusObj.bytesReceived)} / {formatBytes(statusObj.totalBytes)}
              </span>
            </div>
            {statusObj.speedBytesPerSec !== undefined && statusObj.speedBytesPerSec > 0 && (
              <p className="text-[10px] font-mono text-primary-400">
                {formatBytes(statusObj.speedBytesPerSec)}/s • ~{statusObj.etaSeconds || 0}s remaining
              </p>
            )}
            {statusObj.error && (
              <p className="text-[10px] text-amber-400 font-medium">{statusObj.error}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1 border-t border-card-border/60">
            {status === 'paused' ? (
              <button
                type="button"
                onClick={() => {
                  resumeDownload(videoId);
                  setShowActiveMenu(false);
                }}
                className="flex-1 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Resume</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  pauseDownload(videoId);
                  setShowActiveMenu(false);
                }}
                className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-foreground text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Pause className="w-3 h-3 fill-current" />
                <span>Pause</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                cancelDownload(videoId);
                setShowActiveMenu(false);
              }}
              className="py-1.5 px-3 rounded-xl hover:bg-rose-500/15 text-rose-400 text-xs font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          DOWNLOADED OPTIONS POPOVER
         ========================================================================= */}
      {showDownloadedMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 bottom-full mb-2 z-50 w-64 p-3 rounded-2xl bg-card/95 border border-card-border shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 space-y-2.5 text-foreground select-none"
        >
          <div className="flex items-center justify-between pb-2 border-b border-card-border/60">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Saved in PrepTea</span>
            </div>
            <button
              onClick={() => setShowDownloadedMenu(false)}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 text-[11px] text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Resolution:</span>
              <span className="font-mono font-bold text-primary-400 bg-primary-950/60 px-1.5 py-0.5 rounded border border-primary-500/30">
                {downloadRecord?.quality || '720p'}
              </span>
            </div>
            {downloadRecord?.sizeBytes && (
              <div className="flex items-center justify-between">
                <span>Storage used:</span>
                <span className="font-mono text-foreground">{formatBytes(downloadRecord.sizeBytes)}</span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/80 leading-relaxed pt-0.5">
              Available for instant offline playback anytime without data.
            </p>
          </div>

          <div className="space-y-1 pt-1 border-t border-card-border/60">
            <Link
              href="/downloads"
              className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-xs font-semibold text-foreground transition-colors group"
            >
              <span>View in Downloads</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
            </Link>
            <button
              type="button"
              onClick={async () => {
                setShowDownloadedMenu(false);
                await deleteDownload(videoId);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl hover:bg-rose-500/15 text-xs font-semibold text-rose-500 hover:text-rose-400 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete from Downloads</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
