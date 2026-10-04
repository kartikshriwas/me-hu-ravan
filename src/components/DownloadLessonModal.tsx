'use client';

import React, { useState, useEffect } from 'react';
import { ArrowDownToLine, X, Loader2, Sparkles, Check } from 'lucide-react';
import { StartDownloadParams } from '@/lib/downloadContext';

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
  { slug: '540p', displayName: '540p', height: 540, sizeBytes: 7.7 * 1024 * 1024 },
  { slug: '360p', displayName: '360p', height: 360, sizeBytes: 5.8 * 1024 * 1024 },
  { slug: '224p', displayName: '224p', height: 224, sizeBytes: 4.5 * 1024 * 1024 },
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
  const [resolvedMetadata, setResolvedMetadata] = useState<{
    thumbnailUrl?: string;
    durationSeconds?: number;
    name?: string;
  } | null>(null);

  useEffect(() => {
    if (!target) return;

    let active = true;
    async function fetchAssets() {
      try {
        setLoading(true);
        const res = await fetch(`/api/video/${target!.videoId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (!active) return;

        if (json.success && json.video && Array.isArray(json.video.assets) && json.video.assets.length > 0) {
          const apiAssets: VideoAssetOption[] = json.video.assets.map((a: any) => ({
            slug: a.slug || `${a.height}p`,
            displayName: a.displayName || `${a.height}p`,
            height: a.height || 0,
            sizeBytes: a.sizeBytes || 0,
            url: a.url || '',
          }));

          // Sort descending by height (1080p -> 720p -> 540p -> 360p -> 224p)
          apiAssets.sort((a, b) => b.height - a.height);
          setAssets(apiAssets);

          setResolvedMetadata({
            thumbnailUrl: json.video.thumbnailUrl,
            durationSeconds: json.video.durationSeconds,
            name: json.video.name,
          });

          // Check if preferred quality exists
          const preferredHeight = localStorage.getItem('preptea_preferred_quality');
          const prefMatch = preferredHeight ? apiAssets.find((a) => a.height === parseInt(preferredHeight, 10)) : null;

          if (prefMatch) {
            setSelectedSlug(prefMatch.slug);
          } else {
            const defaultChoice =
              apiAssets.find((a) => a.height === 720) ||
              apiAssets.find((a) => a.height === 1080) ||
              apiAssets[0];
            if (defaultChoice) setSelectedSlug(defaultChoice.slug);
          }
        }
      } catch (e) {
        // Fallback to default estimated asset tiers
        console.warn('Could not fetch exact video assets for download modal, using standard tiers:', e);
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
        className="w-full max-w-sm sm:max-w-md p-5 sm:p-6 rounded-3xl bg-card border border-card-border shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-foreground"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-card-border/60">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-400">
            <ArrowDownToLine className="w-4 h-4" />
            <span>Download Lesson</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content details */}
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-bold text-foreground line-clamp-2 leading-snug">
            {target.unitTitle}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Select video quality to save inside PrepTea. Watch offline without data. (Not exported to gallery).
          </p>
        </div>

        {/* Quality Options List */}
        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-0.5">
          {assets.map((asset) => {
            const isSelected = selectedSlug === asset.slug;
            const sizeMb = (asset.sizeBytes / (1024 * 1024)).toFixed(1);

            return (
              <button
                key={asset.slug}
                type="button"
                onClick={() => setSelectedSlug(asset.slug)}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary-950/40 border-primary-500/60 ring-1 ring-primary-500/30'
                    : 'bg-card/70 hover:bg-slate-800/40 border-card-border/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'border-primary-400 bg-primary-500 text-white'
                        : 'border-slate-600'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-foreground block">
                      {asset.displayName}
                    </span>
                  </div>
                </div>

                <span className="text-xs font-mono font-medium text-muted-foreground bg-card/80 px-2 py-0.5 rounded-lg border border-card-border/80">
                  ~{sizeMb} MB
                </span>
              </button>
            );
          })}
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
