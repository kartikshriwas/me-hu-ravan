'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Play,
  Pause,
  Maximize,
  Minimize,
  Settings,
  RotateCcw,
  FastForward,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  PictureInPicture2,
  Check,
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';

interface VideoAsset {
  type: string;
  slug: string;
  displayName: string;
  width: number;
  height: number;
  sizeBytes: number;
  bitrate: number;
  url: string;
}

interface WistiaVideoData {
  id: string;
  name: string;
  durationSeconds: number;
  thumbnailUrl: string;
  assets: VideoAsset[];
}

interface CustomVideoPlayerProps {
  videoId: string; // Wistia sourceid or unit id
  title?: string;
  embedHtml?: string;
  onClose?: () => void;
  prevVideoUrl?: string;
  nextVideoUrl?: string;
  prevTitle?: string;
  nextTitle?: string;
}

export function CustomVideoPlayer({ 
  videoId, 
  title, 
  embedHtml,
  onClose, 
  prevVideoUrl, 
  nextVideoUrl,
  prevTitle,
  nextTitle
}: CustomVideoPlayerProps) {
  const router = useRouter();
  const [videoData, setVideoData] = useState<WistiaVideoData | null>(null);
  const [loading, setLoading] = useState<boolean>(!embedHtml);
  const [error, setError] = useState<string | null>(null);

  // Playing State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);

  // Gesture & Ripple feedback
  const [seekFeedback, setSeekFeedback] = useState<{ type: 'rewind' | 'forward'; id: number } | null>(null);
  const [scrubHoverTime, setScrubHoverTime] = useState<number | null>(null);
  const [scrubHoverPos, setScrubHoverPos] = useState<number>(0);

  // Custom Menu Popovers
  const [activeAsset, setActiveAsset] = useState<VideoAsset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<VideoAsset | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'main' | 'quality' | 'speed'>('main');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Buffering & Auto-Play states
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [showAutoPlayOverlay, setShowAutoPlayOverlay] = useState(false);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState(10);
  const [autoPlayCancelled, setAutoPlayCancelled] = useState(false);
  const [preloadingAsset, setPreloadingAsset] = useState<VideoAsset | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSeekTimeRef = useRef<number>(0);
  const wasPlayingBeforeSwitchRef = useRef<boolean>(false);
  const pendingQualityTargetRef = useRef<{ asset: VideoAsset; switchTime: number } | null>(null);
  const isSwitchingQualityRef = useRef<boolean>(false);
  const preloadingVideoRef = useRef<HTMLVideoElement>(null);
  const isPreloadReadyRef = useRef<boolean>(false);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  // 1. Fetch Video Metadata from API Proxy (only if not an iframe embed)
  useEffect(() => {
    if (embedHtml) {
      setLoading(false);
      return;
    }

    let active = true;
    async function fetchMetadata() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/video/${videoId}`);
        const json = await res.json();
        
        if (!active) return;

        if (json.success && json.video) {
          const video: WistiaVideoData = json.video;
          setVideoData(video);
          
          let preferredHeight: number | null = null;
          try {
            const stored = localStorage.getItem('preptea_preferred_quality');
            if (stored) preferredHeight = parseInt(stored, 10);
          } catch (e) {
            // ignore
          }

          let defaultAsset = null;
          if (preferredHeight) {
            defaultAsset = video.assets.find((a) => a.height === preferredHeight);
          }

          if (!defaultAsset) {
            defaultAsset =
              video.assets.find((a) => a.height === 1080) ||
              video.assets.find((a) => a.height === 720) ||
              video.assets.find((a) => a.height === 540) ||
              video.assets[0] ||
              null;
          }
          
          setActiveAsset(defaultAsset);
          setSelectedAsset(defaultAsset);
        } else {
          setError(json.error || 'Failed to load video details.');
        }
      } catch (err) {
        if (active) setError('An error occurred while loading the video.');
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchMetadata();
    return () => {
      active = false;
    };
  }, [videoId, embedHtml]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // 2. Hide controls automatically on mouse/touch idle
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSettings(false);
      }
    }, 3500);
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // 3. Play/Pause Action
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  };

  // Skip video +/- seconds
  const seekRelative = (seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);

    setSeekFeedback({
      type: seconds < 0 ? 'rewind' : 'forward',
      id: Date.now()
    });

    setTimeout(() => {
      setSeekFeedback(null);
    }, 650);
  };

  // Double tap gesture handler for mobile devices & video overlay clicks
  const handleContainerTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    let clientX = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
    } else if ('clientX' in e) {
      clientX = e.clientX;
    }

    const clickX = clientX - rect.left;
    const isLeftHalf = clickX < rect.width / 2;

    if (now - lastTapRef.current.time < 300) {
      if (isLeftHalf) {
        seekRelative(-10);
      } else {
        seekRelative(10);
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: clickX };
      resetControlsTimeout();
    }
  };

  const getBufferedEnd = (video: HTMLVideoElement): number => {
    const time = video.currentTime;
    const buffered = video.buffered;
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= time && time <= buffered.end(i)) {
        return buffered.end(i);
      }
    }
    return time;
  };

  const executeQualitySwitch = (asset: VideoAsset) => {
    if (!videoRef.current) return;
    wasPlayingBeforeSwitchRef.current = !videoRef.current.paused;
    pendingSeekTimeRef.current = videoRef.current.currentTime;
    isSwitchingQualityRef.current = true;
    setActiveAsset(asset);
    setSelectedAsset(asset);
  };

  const handlePreloadCanPlay = () => {
    if (!preloadingAsset) return;
    isPreloadReadyRef.current = true;
    if (!pendingQualityTargetRef.current) {
      const asset = preloadingAsset;
      setPreloadingAsset(null);
      executeQualitySwitch(asset);
    }
  };

  const handleProgress = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const time = video.currentTime;
    const buffered = video.buffered;
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= time && time <= buffered.end(i)) {
        setBufferedEnd(buffered.end(i));
        return;
      }
    }
  };

  const handleVideoEnded = () => {
    if (nextVideoUrl && !autoPlayCancelled) {
      router.push(nextVideoUrl);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const currentTimeVal = videoRef.current.currentTime;
    setCurrentTime(currentTimeVal);
    handleProgress();

    if (pendingQualityTargetRef.current && isPreloadReadyRef.current) {
      const { asset, switchTime } = pendingQualityTargetRef.current;
      if (currentTimeVal >= switchTime - 0.5) {
        pendingQualityTargetRef.current = null;
        setPreloadingAsset(null);
        executeQualitySwitch(asset);
      }
    }

    if (nextVideoUrl && !autoPlayCancelled && duration > 0) {
      const remaining = duration - currentTimeVal;
      if (remaining <= 10 && remaining > 0) {
        setShowAutoPlayOverlay(true);
        setAutoPlayCountdown(Math.max(0, Math.ceil(remaining)));
      } else {
        setShowAutoPlayOverlay(false);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    isSwitchingQualityRef.current = false;

    if (pendingSeekTimeRef.current > 0) {
      videoRef.current.currentTime = pendingSeekTimeRef.current;
      pendingSeekTimeRef.current = 0;
      if (wasPlayingBeforeSwitchRef.current) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekTo = parseFloat(e.target.value);
    videoRef.current.currentTime = seekTo;
    setCurrentTime(seekTo);
  };

  const handleScrubMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setScrubHoverPos(pos * 100);
    setScrubHoverTime(pos * duration);
  };

  const handleScrubMouseLeave = () => {
    setScrubHoverTime(null);
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSettings(false);
  };

  const handleQualityChange = (asset: VideoAsset) => {
    if (!videoRef.current || !activeAsset) return;
    setSelectedAsset(asset);

    try {
      localStorage.setItem('preptea_preferred_quality', asset.height.toString());
    } catch (e) {
      // ignore
    }

    const isHighToLow = asset.height < activeAsset.height;
    isPreloadReadyRef.current = false;
    setPreloadingAsset(asset);

    if (isHighToLow) {
      const bufferedEndVal = getBufferedEnd(videoRef.current);
      pendingQualityTargetRef.current = { asset, switchTime: bufferedEndVal };
    } else {
      pendingQualityTargetRef.current = null;
    }
    setShowSettings(false);
  };

  const togglePictureInPicture = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      // ignore
    }
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      if (isInput || !videoRef.current) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'f':
          e.preventDefault();
          handleToggleFullscreen();
          break;
        case 'p':
          e.preventDefault();
          togglePictureInPicture();
          break;
        case 'arrowright':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'arrowleft':
          e.preventDefault();
          seekRelative(-10);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // YouTube Embed Renderer fallback
  if (embedHtml) {
    const srcMatch = embedHtml.match(/src=["']([^"']+)["']/i);
    let embedSrc = srcMatch ? srcMatch[1] : '';
    if (embedSrc) {
      const sep = embedSrc.includes('?') ? '&' : '?';
      embedSrc += `${sep}autoplay=1`;
    }

    return (
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-red-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> YouTube Video
            </span>
            <h3 className="text-xs sm:text-sm font-bold text-white truncate">{title || 'YouTube Video'}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {prevVideoUrl && (
              <Link
                href={prevVideoUrl}
                className="text-xs font-bold text-slate-300 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 hover:border-indigo-500/50 transition-all flex items-center gap-1 touch-manipulation"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Prev</span>
              </Link>
            )}
            {nextVideoUrl && (
              <Link
                href={nextVideoUrl}
                className="text-xs font-bold text-slate-300 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 hover:border-indigo-500/50 transition-all flex items-center gap-1 touch-manipulation"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-xs font-bold text-slate-400 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 transition-all"
              >
                Close
              </button>
            )}
          </div>
        </div>

        <div className="relative w-full aspect-[16/10] sm:aspect-video min-h-[220px] sm:min-h-0 bg-black rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
          {embedSrc ? (
            <iframe
              src={embedSrc}
              title={title || 'YouTube Video'}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: embedHtml }} className="w-full h-full flex items-center justify-center" />
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full aspect-[16/10] sm:aspect-video min-h-[220px] sm:min-h-0 flex flex-col items-center justify-center bg-slate-950/90 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-6">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-xs text-slate-400 mt-3 font-medium">Loading high-definition stream...</p>
      </div>
    );
  }

  if (error || !videoData || !activeAsset) {
    return (
      <div className="w-full aspect-[16/10] sm:aspect-video min-h-[220px] sm:min-h-0 flex flex-col items-center justify-center bg-slate-950/90 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-6 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-500" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-white">Playback Stream Error</p>
          <p className="text-xs text-slate-400 max-w-sm">{error || 'Could not load video source stream.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2.5">
      {/* Player Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">

          <h3 className="text-xs sm:text-sm font-bold text-white truncate">{title || videoData.name}</h3>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {prevVideoUrl && (
            <Link
              href={prevVideoUrl}
              className="text-xs font-bold text-slate-300 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 hover:border-indigo-500/50 transition-all flex items-center gap-1 touch-manipulation"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </Link>
          )}
          {nextVideoUrl && (
            <Link
              href={nextVideoUrl}
              className="text-xs font-bold text-slate-300 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 hover:border-indigo-500/50 transition-all flex items-center gap-1 touch-manipulation"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs font-bold text-slate-400 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 transition-all"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Main Video Container */}
      <div
        ref={containerRef}
        onMouseMove={resetControlsTimeout}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        onClick={handleContainerTap}
        className="relative w-full aspect-[16/10] sm:aspect-video min-h-[220px] sm:min-h-0 bg-black rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-800/80 shadow-2xl group select-none touch-none"
      >
        <video
          ref={videoRef}
          src={activeAsset.url}
          className="w-full h-full object-contain cursor-pointer transition-all"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onProgress={handleProgress}
          onEnded={handleVideoEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            if (isSwitchingQualityRef.current) return;
            setIsPlaying(false);
          }}
          autoPlay
          playsInline
        />

        {/* Double Tap Seek Feedback Ripple Overlay */}
        {seekFeedback && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center justify-center p-5 sm:p-6 rounded-full bg-indigo-600/40 backdrop-blur-md border border-indigo-400/50 text-white animate-ping duration-500 ${
              seekFeedback.type === 'rewind' ? 'left-8 sm:left-12' : 'right-8 sm:right-12'
            }`}
          >
            {seekFeedback.type === 'rewind' ? (
              <RotateCcw className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            ) : (
              <FastForward className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            )}
            <span className="text-xs font-extrabold mt-1">
              {seekFeedback.type === 'rewind' ? '-10s' : '+10s'}
            </span>
          </div>
        )}

        {/* Centered Play/Pause Toggle Button */}
        {showControls && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPause();
              }}
              className="pointer-events-auto w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-slate-950/80 border border-slate-700/60 text-white flex items-center justify-center backdrop-blur-md shadow-2xl hover:scale-110 hover:bg-indigo-600 hover:border-indigo-400 transition-all duration-200"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 sm:w-8 sm:h-8 fill-white ml-0" />
              ) : (
                <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-white ml-1" />
              )}
            </button>
          </div>
        )}

        {/* Controls Gradient Mask */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-slate-950/95 via-transparent to-slate-950/40 transition-opacity duration-300 pointer-events-none ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Settings Popover UX Modal - Fits perfectly inside player bounds */}
        {showSettings && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="absolute right-2 sm:right-6 bottom-14 sm:bottom-16 z-40 w-56 sm:w-60 max-h-[75%] overflow-y-auto rounded-2xl bg-slate-950/95 border border-slate-800 p-2.5 shadow-2xl text-slate-200 text-xs backdrop-blur-2xl custom-scrollbar animate-in fade-in zoom-in-95 duration-150"
          >


            {settingsTab === 'main' && (
              <div className="space-y-0.5">
                <button
                  onClick={() => setSettingsTab('quality')}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-900/90 transition-all font-semibold"
                >
                  <span className="text-slate-300">Stream Quality</span>
                  <span className="text-indigo-400 font-bold">{selectedAsset?.displayName || activeAsset?.displayName}</span>
                </button>

                <button
                  onClick={() => setSettingsTab('speed')}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-900/90 transition-all font-semibold"
                >
                  <span className="text-slate-300">Playback Speed</span>
                  <span className="text-indigo-400 font-bold">{playbackRate === 1 ? 'Normal' : `${playbackRate}x`}</span>
                </button>
              </div>
            )}

            {settingsTab === 'quality' && (
              <div className="space-y-0.5">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5 mb-1 px-1 font-bold text-slate-400 text-[10px] uppercase tracking-wider">
                  <span>Select Quality</span>
                  <button onClick={() => setSettingsTab('main')} className="text-indigo-400 hover:text-indigo-300 font-bold">
                    Back
                  </button>
                </div>
                {videoData.assets.map((asset) => (
                  <button
                    key={asset.slug}
                    onClick={() => handleQualityChange(asset)}
                    className={`w-full text-left p-2 rounded-xl hover:bg-slate-900/90 transition-all flex items-center justify-between font-semibold ${
                      selectedAsset?.slug === asset.slug ? 'text-indigo-400 bg-indigo-950/40 border border-indigo-500/20' : 'text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {selectedAsset?.slug === asset.slug && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      <span>{asset.displayName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">{(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                  </button>
                ))}
              </div>
            )}

            {settingsTab === 'speed' && (
              <div className="space-y-0.5">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5 mb-1 px-1 font-bold text-slate-400 text-[10px] uppercase tracking-wider">
                  <span>Select Speed</span>
                  <button onClick={() => setSettingsTab('main')} className="text-indigo-400 hover:text-indigo-300 font-bold">
                    Back
                  </button>
                </div>
                {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => handleSpeedChange(rate)}
                    className={`w-full text-left p-2 rounded-xl hover:bg-slate-900/90 transition-all flex items-center justify-between font-semibold ${
                      playbackRate === rate ? 'text-indigo-400 bg-indigo-950/40 border border-indigo-500/20' : 'text-slate-300'
                    }`}
                  >
                    <span>{rate === 1 ? 'Normal (1.0x)' : `${rate}x`}</span>
                    {playbackRate === rate && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Video Controls Bottom Bar */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-0 inset-x-0 p-2.5 sm:p-4 flex flex-col gap-2 transition-opacity duration-300 z-30 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Interactive Touch Progress Bar */}
          <div 
            className="relative w-full h-7 flex items-center group/timeline cursor-pointer touch-none"
            onMouseMove={handleScrubMouseMove}
            onMouseLeave={handleScrubMouseLeave}
          >
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-slate-800/90 group-hover/timeline:h-2.5 transition-all" />
            
            <div 
              style={{ width: `${duration > 0 ? (bufferedEnd / duration) * 100 : 0}%` }} 
              className="absolute left-0 h-1.5 rounded-full bg-slate-600/50 group-hover/timeline:h-2.5 transition-all" 
            />
            
            <div 
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} 
              className="absolute left-0 h-1.5 rounded-full bg-indigo-500 group-hover/timeline:h-2.5 transition-all shadow-[0_0_12px_rgba(99,102,241,0.6)]" 
            />

            {scrubHoverTime !== null && (
              <div
                style={{ left: `${scrubHoverPos}%` }}
                className="absolute bottom-6 -translate-x-1/2 bg-slate-900 border border-slate-700 px-2 py-1 rounded-md text-[10px] font-mono text-white shadow-xl pointer-events-none z-40"
              >
                {formatTime(scrubHoverTime)}
              </div>
            )}

            <input
              type="range"
              min={0}
              max={duration || 100}
              step="any"
              value={currentTime}
              onChange={handleScrubChange}
              className="absolute inset-x-0 w-full h-full opacity-0 accent-indigo-500 cursor-pointer z-20"
              style={{ background: 'none' }}
            />
          </div>

          {/* Buttons & Options Row */}
          <div className="flex items-center justify-between text-white gap-2">
            <div className="flex items-center gap-1.5 sm:gap-3">
              <button
                onClick={handlePlayPause}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-white touch-manipulation"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-white" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />}
              </button>

              <button
                onClick={() => seekRelative(-10)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-all hidden sm:flex items-center"
                title="-10 Seconds"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => seekRelative(10)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-all hidden sm:flex items-center"
                title="+10 Seconds"
              >
                <FastForward className="w-4 h-4" />
              </button>

              <span className="text-[10px] sm:text-xs font-mono text-slate-300 tracking-tight">
                {formatTime(currentTime)} <span className="text-slate-500">/</span> {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {selectedAsset && (
                <span className="hidden sm:inline-block text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-indigo-950/80 border border-indigo-500/30 text-indigo-300">
                  {selectedAsset.displayName}
                </span>
              )}

              <button
                onClick={() => {
                  setShowSettings(!showSettings);
                  setSettingsTab('main');
                }}
                className={`p-1.5 sm:p-2 rounded-xl hover:bg-white/10 transition-all text-slate-200 ${showSettings ? 'bg-white/20 text-white' : ''}`}
                aria-label="Settings"
              >
                <Settings className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </button>

              {document.pictureInPictureEnabled && (
                <button
                  onClick={togglePictureInPicture}
                  className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-slate-200 transition-colors hidden md:inline-flex"
                  title="Picture-in-Picture"
                >
                  <PictureInPicture2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </button>
              )}

              <button 
                onClick={handleToggleFullscreen} 
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-slate-200 transition-colors"
                aria-label="Fullscreen"
              >
                {isFullscreen ? <Minimize className="w-4.5 h-4.5 sm:w-5 sm:h-5" /> : <Maximize className="w-4.5 h-4.5 sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Auto-Play Next Overlay */}
        {showAutoPlayOverlay && nextVideoUrl && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-16 right-2 sm:right-6 z-40 max-w-[260px] sm:max-w-xs p-3.5 rounded-2xl bg-slate-950/95 border border-indigo-500/30 shadow-2xl backdrop-blur-xl animate-in fade-in flex flex-col gap-2 text-left text-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider">Up Next</span>
                <p className="text-xs font-bold text-slate-100 line-clamp-1 mt-0.5">{nextTitle || "Next Video"}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Playing in <span className="font-bold text-white text-xs">{autoPlayCountdown}s</span>...</p>
              </div>
              <button 
                onClick={() => {
                  setAutoPlayCancelled(true);
                  setShowAutoPlayOverlay(false);
                }}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Cancel Auto-play"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => router.push(nextVideoUrl)}
                className="flex-1 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors text-center shadow-lg shadow-indigo-600/30"
              >
                Play Now
              </button>
              <button
                onClick={() => {
                  setAutoPlayCancelled(true);
                  setShowAutoPlayOverlay(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Preloader background element */}
        {preloadingAsset && (
          <video
            ref={preloadingVideoRef}
            src={preloadingAsset.url}
            className="hidden"
            preload="auto"
            muted
            onCanPlay={handlePreloadCanPlay}
          />
        )}
      </div>
    </div>
  );
}
