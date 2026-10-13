'use client';

import React, { useState, useEffect } from 'react';
import { ArrowDownToLine, X, Loader2, Sparkles, Check, Sliders, Settings, RotateCcw, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { StartDownloadParams } from '@/lib/downloadContext';
import { findBestMatchingAsset, matchQualityWithFallback, getRememberedQuality, saveRememberedQuality } from '@/lib/qualityMatcher';

export interface SingleLessonDownloadTarget {
  videoId: string;
  courseSlug: string;
  courseTitle: string;
  sectionTitle: string;
  sectionId?: string;
  unitTitle: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}

interface VideoAssetOption {
  slug: string;
  displayName: string;
  height: number;
  sizeBytes: number;
  url?: string;
}

const DEFAULT_OPTIONS: VideoAssetOption[] = [
  { slug: '1080p', displayName: '1080p', height: 1080, sizeBytes: 17.2 * 1024 * 1024 },
  { slug: '720p', displayName: '720p', height: 720, sizeBytes: 10.1 * 1024 * 1024 },
  { slug: '540p', displayName: '540p', height: 540, sizeBytes: 7.2 * 1024 * 1024 },
  { slug: '360p', displayName: '360p', height: 360, sizeBytes: 4.8 * 1024 * 1024 },
];

interface DownloadLessonModalProps {
  target: SingleLessonDownloadTarget | null;
  onClose: () => void;
  onStartDownload: (params: StartDownloadParams) => void;
}

export function DownloadLessonModal({
  target,
  onClose,
  onStartDownload,
}: DownloadLessonModalProps) {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<VideoAssetOption[]>(DEFAULT_OPTIONS);
  const [selectedSlug, setSelectedSlug] = useState<string>('720p');
  const [rememberPreference, setRememberPreference] = useState(false);
  const [resolvedMetadata, setResolvedMetadata] = useState<{
    thumbnailUrl?: string;
    durationSeconds?: number;
    name?: string;
  } | null>(null);

  const [fallbackWarning, setFallbackWarning] = useState<{
    requested: string;
    actual: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const rem = localStorage.getItem('preptea_remember_download_quality') === 'true';
      setRememberPreference(rem);
    }
  }, []);

  useEffect(() => {
    if (!target) return;
    setFallbackWarning(null);

    let active = true;
    async function fetchAssets() {
      try {
        setLoading(true);
        const res = await fetch(`/api/video/${target!.videoId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (!active) return;

        if (json.success && json.video && Array.isArray(json.video.assets) && json.video.assets.length > 0) {
          // Strictly restrict to 4 download qualities: 1080, 720, 540, 360
          const apiAssets: VideoAssetOption[] = json.video.assets
            .filter((a: any) => [1080, 720, 540, 360].includes(a.height || 0))
            .map((a: any) => ({
              slug: a.slug || `${a.height}p`,
              displayName: a.displayName || `${a.height}p`,
              height: a.height || 0,
              sizeBytes: a.sizeBytes || 0,
              url: a.url || '',
            }));

          // Sort descending by height (1080p -> 720p -> 540p -> 360p)
          apiAssets.sort((a, b) => b.height - a.height);
          const finalAssets = apiAssets.length > 0 ? apiAssets : DEFAULT_OPTIONS;
          setAssets(finalAssets);

          setResolvedMetadata({
            thumbnailUrl: json.video.thumbnailUrl,
            durationSeconds: json.video.durationSeconds,
            name: json.video.name,
          });

          // Check if preferred quality exists. If "ask me" is enabled, preselect remembered or 720p!
          const targetPref = getRememberedQuality('720p');

          const match = matchQualityWithFallback(finalAssets, targetPref);
          if (match && match.asset) {
            setSelectedSlug(match.asset.slug);
            if (!match.isExact) {
              setFallbackWarning({
                requested: match.requestedQuality,
                actual: match.actualQuality,
              });
            }
          }
        } else {
          // Default asset tiers fallback: select remembered or 720p
          setSelectedSlug(getRememberedQuality('720p'));
        }
      } catch (e) {
        // Fallback to default estimated asset tiers
        console.warn('Could not fetch exact video assets for download modal, using standard tiers:', e);
        setSelectedSlug(getRememberedQuality('720p'));
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchAssets();
    return () => {
      active = false;
    };
  }, [target]);

  if (!target) return null;

  const handleConfirm = () => {
    const chosen = assets.find((a) => a.slug === selectedSlug) || assets[0];
    if (typeof window !== 'undefined') {
      saveRememberedQuality(chosen.height || 720);
      if (rememberPreference) {
        localStorage.setItem('preptea_remember_download_quality', 'true');
      } else {
        localStorage.removeItem('preptea_remember_download_quality');
      }
    }
    onStartDownload({
      videoId: target.videoId,
      courseSlug: target.courseSlug,
      courseTitle: target.courseTitle,
      sectionTitle: target.sectionTitle,
      sectionId: target.sectionId,
      unitTitle: target.unitTitle,
      thumbnailUrl: target.thumbnailUrl || resolvedMetadata?.thumbnailUrl || '',
      durationSeconds: target.durationSeconds || resolvedMetadata?.durationSeconds || 0,
      quality: chosen.displayName || `${chosen.height}p`,
      assetUrl: chosen.url || undefined,
      expectedSizeBytes: chosen.sizeBytes,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm sm:max-w-md p-5 sm:p-6 rounded-3xl bg-slate-900/95 border border-slate-700/80 shadow-[0_20px_60px_rgba(0,0,0,0.85)] space-y-4 animate-in zoom-in-95 duration-200 text-foreground ring-1 ring-white/10 backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-400">
              <ArrowDownToLine className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block uppercase tracking-wider">Download Lesson</span>
              <span className="text-[10px] text-slate-400">Saved offline in PrepTea</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content details */}
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug">
            {target.unitTitle}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Select video quality for offline saving.
          </p>
        </div>

        {/* Fallback Notice if preferred quality was not available */}
        {fallbackWarning && (
          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <span className="font-bold text-amber-200">
                {fallbackWarning.requested} is not available
              </span>{' '}
              for this specific video. We selected{' '}
              <span className="font-bold underline text-amber-100">{fallbackWarning.actual}</span>{' '}
              as the closest quality. You can choose any available resolution below:
            </div>
          </div>
        )}

        {/* Quality Options List with Modern Cards */}
        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-0.5">
          {assets.map((asset) => {
            const isSelected = selectedSlug === asset.slug;
            const sizeMb = (asset.sizeBytes / (1024 * 1024)).toFixed(1);
            const isHD = asset.height >= 720;
            const isFullHD = asset.height >= 1080;

            return (
              <button
                key={asset.slug}
                type="button"
                onClick={() => setSelectedSlug(asset.slug)}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-primary-950/80 via-primary-900/40 to-slate-900 border-primary-500/60 ring-1 ring-primary-500/40 shadow-lg shadow-primary-950/40'
                    : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'border-primary-400 bg-primary-500 text-white'
                        : 'border-slate-600'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-xs sm:text-sm font-bold text-white block">
                      {asset.displayName}
                    </span>
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

                <span className="text-xs font-mono font-medium text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-700/60 shrink-0">
                  ~{sizeMb} MB
                </span>
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
              onClick={onClose}
              className="text-[11px] text-muted-foreground hover:text-primary-400 flex items-center gap-1 transition-colors"
              title="Manage download preferences"
            >
              <Settings className="w-3 h-3" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </label>
          <p className="text-[10px] text-muted-foreground px-1 leading-relaxed">
            {rememberPreference 
              ? 'Future downloads will start automatically in this resolution. You can switch back to "Ask each time" anytime in Downloads settings.' 
              : 'Unchecked: PrepTea will ask you to choose resolution every time.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-card-border/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-600/30 transition-all cursor-pointer flex items-center gap-2"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Start Download ({assets.find((a) => a.slug === selectedSlug)?.displayName || '720p'})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
