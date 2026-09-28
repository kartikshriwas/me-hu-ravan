'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DOMPurify from 'dompurify';
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
  SlidersHorizontal,
  RectangleHorizontal,
  SkipBack,
  SkipForward
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
  courseSlug?: string;
  title?: string;
  embedHtml?: string;
  onClose?: () => void;
  prevVideoUrl?: string;
  nextVideoUrl?: string;
  prevTitle?: string;
  nextTitle?: string;
  isTheaterMode?: boolean;
  onToggleTheaterMode?: () => void;
}

export function CustomVideoPlayer({ 
  videoId, 
  courseSlug,
  title, 
  embedHtml,
  onClose, 
  prevVideoUrl, 
  nextVideoUrl,
  prevTitle,
  nextTitle,
  isTheaterMode = false,
  onToggleTheaterMode
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
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSeekTimeRef = useRef<number>(0);
  const wasPlayingBeforeSwitchRef = useRef<boolean>(false);
  const pendingQualityTargetRef = useRef<{ asset: VideoAsset; switchTime: number } | null>(null);
  const isSwitchingQualityRef = useRef<boolean>(false);
  const preloadingVideoRef = useRef<HTMLVideoElement>(null);
  const isPreloadReadyRef = useRef<boolean>(false);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const lastSaveTimeRef = useRef<number>(0);
  const hasRestoredTimeRef = useRef<boolean>(false);

  useEffect(() => {
    hasRestoredTimeRef.current = false;
  }, [videoId]);

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
          let preferredName: string | null = null;
          let preferredSlug: string | null = null;
          try {
            const storedHeight = localStorage.getItem('preptea_preferred_quality');
            if (storedHeight) preferredHeight = parseInt(storedHeight, 10);
            preferredName = localStorage.getItem('preptea_preferred_quality_name');
            preferredSlug = localStorage.getItem('preptea_preferred_quality_slug');
          } catch (e) {
            // ignore
          }

          let defaultAsset: VideoAsset | null = null;
          if (preferredHeight) {
            defaultAsset = video.assets.find((a) => a.height === preferredHeight) || null;
          }
          if (!defaultAsset && preferredName) {
            defaultAsset = video.assets.find((a) => a.displayName.toLowerCase() === preferredName.toLowerCase()) || null;
          }
          if (!defaultAsset && preferredSlug) {
            defaultAsset = video.assets.find((a) => a.slug === preferredSlug) || null;
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

  // Restore preferred playback speed from localStorage on initial mount
  useEffect(() => {
    try {
      const storedSpeed = localStorage.getItem('preptea_preferred_speed');
      if (storedSpeed) {
        const rate = parseFloat(storedSpeed);
        if (!isNaN(rate) && rate > 0) {
          setPlaybackRate(rate);
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Sync global media playing status for ActivityTracker telemetry
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__preptea_media_playing = isPlaying;
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__preptea_media_playing = false;
      }
    };
  }, [isPlaying]);

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
      if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
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

  // Seek to percentage of video duration (0 = 0%, 1 = 10%, ... 9 = 90%)
  const seekToFraction = (fraction: number) => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || duration || 0;
    if (dur <= 0) return;
    const targetTime = Math.max(0, Math.min(dur, dur * fraction));
    const isRewind = targetTime < videoRef.current.currentTime;
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);

    setSeekFeedback({
      type: isRewind ? 'rewind' : 'forward',
      id: Date.now()
    });

    setTimeout(() => {
      setSeekFeedback(null);
    }, 650);
  };

  // Double tap gesture handler for 10s seek & single tap play/pause anywhere on player
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
      // Second tap of double tap: cancel single tap play/pause
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      if (isLeftHalf) {
        seekRelative(-10);
      } else {
        seekRelative(10);
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: clickX };
      resetControlsTimeout();

      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
      singleTapTimeoutRef.current = setTimeout(() => {
        handlePlayPause();
        singleTapTimeoutRef.current = null;
      }, 250);
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
    try {
      const storedCompleted = localStorage.getItem('preptea_completed_videos');
      const completedList: string[] = storedCompleted ? JSON.parse(storedCompleted) : [];
      if (!completedList.includes(videoId)) {
        completedList.push(videoId);
        localStorage.setItem('preptea_completed_videos', JSON.stringify(completedList));
      }
    } catch (e) {
      // ignore
    }

    if (nextVideoUrl && !autoPlayCancelled) {
      router.push(nextVideoUrl);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const currentTimeVal = videoRef.current.currentTime;
    setCurrentTime(currentTimeVal);
    handleProgress();

    // Throttled progress & timestamp persistence (every 2 seconds)
    if (Date.now() - lastSaveTimeRef.current > 2000 && videoId && currentTimeVal > 2) {
      lastSaveTimeRef.current = Date.now();
      try {
        localStorage.setItem(`preptea_video_time_${videoId}`, currentTimeVal.toString());

        if (courseSlug) {
          localStorage.setItem(`preptea_last_video_${courseSlug}`, JSON.stringify({
            videoId,
            title: title || videoData?.name || 'Video Lesson',
            timestamp: currentTimeVal,
            updatedAt: Date.now()
          }));
        }

        if (duration > 0 && currentTimeVal / duration >= 0.88) {
          const storedCompleted = localStorage.getItem('preptea_completed_videos');
          const completedList: string[] = storedCompleted ? JSON.parse(storedCompleted) : [];
          if (!completedList.includes(videoId)) {
            completedList.push(videoId);
            localStorage.setItem('preptea_completed_videos', JSON.stringify(completedList));
          }
        }
      } catch (e) {
        // ignore
      }
    }

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
    const vidDuration = videoRef.current.duration;
    setDuration(vidDuration);
    videoRef.current.playbackRate = playbackRate;
    isSwitchingQualityRef.current = false;

    if (pendingSeekTimeRef.current > 0) {
      videoRef.current.currentTime = pendingSeekTimeRef.current;
      pendingSeekTimeRef.current = 0;
      if (wasPlayingBeforeSwitchRef.current) {
        videoRef.current.play().catch(() => {});
      }
    } else if (!hasRestoredTimeRef.current) {
      hasRestoredTimeRef.current = true;
      try {
        const saved = localStorage.getItem(`preptea_video_time_${videoId}`);
        if (saved) {
          const savedTime = parseFloat(saved);
          if (savedTime > 5 && vidDuration > 0 && savedTime < vidDuration - 10) {
            videoRef.current.currentTime = savedTime;
            setCurrentTime(savedTime);
          }
        }
      } catch (e) {
        // ignore
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
    try {
      localStorage.setItem('preptea_preferred_speed', rate.toString());
    } catch (e) {
      // ignore
    }
    setShowSettings(false);
  };

  const handleQualityChange = (asset: VideoAsset) => {
    if (!videoRef.current || !activeAsset) return;
    setSelectedAsset(asset);

    try {
      localStorage.setItem('preptea_preferred_quality', asset.height.toString());
      localStorage.setItem('preptea_preferred_quality_name', asset.displayName);
      localStorage.setItem('preptea_preferred_quality_slug', asset.slug);
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
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || (activeEl as HTMLElement)?.isContentEditable;
      if (isInput) return;

      // Shift + Right Arrow: Next Video
      if (e.shiftKey && (e.key === 'ArrowRight' || e.code === 'ArrowRight')) {
        if (nextVideoUrl) {
          e.preventDefault();
          router.push(nextVideoUrl);
        }
        return;
      }

      // Shift + Left Arrow: Previous (Preview) Video
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.code === 'ArrowLeft')) {
        if (prevVideoUrl) {
          e.preventDefault();
          router.push(prevVideoUrl);
        }
        return;
      }

      if (!videoRef.current) return;

      // Number keys 0-9: Seek to 0%, 10%, 20% ... 90% of video
      if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        const fraction = parseInt(e.key, 10) / 10;
        seekToFraction(fraction);
        return;
      }

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
  }, [isPlaying, nextVideoUrl, prevVideoUrl, router]);

  // YouTube Embed Renderer fallback
  if (embedHtml) {
    const srcMatch = embedHtml.match(/src=["']([^"']+)["']/i);
    let embedSrc = srcMatch ? srcMatch[1] : '';
    if (embedSrc) {
      const sep = embedSrc.includes('?') ? '&' : '?';
      embedSrc += `${sep}autoplay=1`;
    }

    return (
      <div className="w-full flex flex-col gap-3">
        <div className="relative w-full aspect-[16/10] sm:aspect-video min-h-[220px] sm:min-h-0 bg-black rounded-2xl sm:rounded-3xl overflow-hidden border border-card-border shadow-2xl order-1">
          {embedSrc ? (
            <iframe
              src={embedSrc}
              title={title || 'YouTube Video'}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(embedHtml, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'src'] }) }} className="w-full h-full flex items-center justify-center" />
          )}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-card/60 border border-card-border/80 order-2">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-red-600 dark:text-red-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> YouTube Video
            </span>
            <h3 className="text-xs sm:text-sm font-bold text-foreground truncate mt-0.5">{title || 'YouTube Video'}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {prevVideoUrl && (
              <Link
                href={prevVideoUrl}
                className="text-xs sm:text-sm font-semibold text-foreground hover:text-foreground px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 hover:border-primary-500/50 transition-all flex items-center gap-1.5 touch-manipulation"
                title={prevTitle ? `Previous (Shift + ←): ${prevTitle}` : "Previous Video (Shift + ←)"}
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                <span>Previous</span>
              </Link>
            )}
            {nextVideoUrl && (
              <Link
                href={nextVideoUrl}
                className="text-xs sm:text-sm font-semibold text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-primary-600 hover:bg-primary-500 border border-primary-400/30 transition-all flex items-center gap-1.5 shadow-md shadow-primary-950/40 touch-manipulation"
                title={nextTitle ? `Next (Shift + →): ${nextTitle}` : "Next Video (Shift + →)"}
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 text-foreground" />
              </Link>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-xs font-bold text-muted-foreground hover:text-foreground px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 transition-all"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full aspect-[16/10] sm:aspect-video min-h-[220px] sm:min-h-0 flex flex-col items-center justify-center bg-background/90 border border-card-border/80 rounded-2xl sm:rounded-3xl p-6">
        <Loader2 className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin" />
        <p className="text-xs text-muted-foreground mt-3 font-medium">Loading high-definition stream...</p>
      </div>
    );
  }

  if (error || !videoData || !activeAsset) {
    return (
      <div className="w-full aspect-[16/10] sm:aspect-video min-h-[220px] sm:min-h-0 flex flex-col items-center justify-center bg-background/90 border border-card-border/80 rounded-2xl sm:rounded-3xl p-6 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-500" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">Playback Stream Error</p>
          <p className="text-xs text-muted-foreground max-w-sm">{error || 'Could not load video source stream.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      {/* Video first on mobile (order-first), title below. On desktop title is on top. */}

      {/* Main Video Container — full bleed */}
      <div
        ref={containerRef}
        onMouseMove={resetControlsTimeout}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        onClick={handleContainerTap}
        className="relative w-full aspect-video min-h-[200px] sm:min-h-0 bg-black overflow-hidden shadow-2xl group select-none touch-none order-1"
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
            className={`absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center justify-center p-5 sm:p-6 rounded-full bg-primary-600/40 backdrop-blur-md border border-primary-400/50 text-white animate-ping duration-500 ${
              seekFeedback.type === 'rewind' ? 'left-8 sm:left-12' : 'right-8 sm:right-12'
            }`}
          >
            {seekFeedback.type === 'rewind' ? (
              <RotateCcw className="w-7 h-7 sm:w-8 sm:h-8 text-foreground" />
            ) : (
              <FastForward className="w-7 h-7 sm:w-8 sm:h-8 text-foreground" />
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
              className="pointer-events-auto w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-background/80 border border-slate-700/60 text-white flex items-center justify-center backdrop-blur-md shadow-2xl hover:scale-110 hover:bg-primary-600 hover:border-primary-400 transition-all duration-200"
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

        {/* Settings Popover UX Modal - Navigation style like original YouTube player, mobile-friendly */}
        {showSettings && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="absolute right-2 sm:right-6 bottom-14 sm:bottom-16 z-40 w-64 sm:w-72 max-h-[80%] overflow-y-auto rounded-2xl bg-background/95 border border-card-border p-2.5 shadow-2xl text-foreground backdrop-blur-2xl custom-scrollbar animate-in fade-in zoom-in-95 duration-150 select-none"
          >
            {/* MAIN MENU TAB */}
            {settingsTab === 'main' && (
              <div className="space-y-1">
                <div className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase px-2 py-1 border-b border-card-border/60 mb-1 flex items-center justify-between">
                  <span>Settings</span>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="p-0.5 rounded-md hover:bg-slate-800 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quality Row */}
                <button
                  onClick={() => setSettingsTab('quality')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-card/90 active:bg-slate-800 transition-all text-xs font-semibold text-foreground touch-manipulation group"
                >
                  <div className="flex items-center gap-2.5">
                    <SlidersHorizontal className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    <span>Quality</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground">
                    <span className="text-[11px] font-medium text-primary-600 dark:text-primary-300 bg-primary-500/10 px-2 py-0.5 rounded-md border border-primary-500/20">
                      {selectedAsset?.displayName || 'Auto'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </button>

                {/* Playback Speed Row */}
                <button
                  onClick={() => setSettingsTab('speed')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-card/90 active:bg-slate-800 transition-all text-xs font-semibold text-foreground touch-manipulation group"
                >
                  <div className="flex items-center gap-2.5">
                    <FastForward className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    <span>Playback Speed</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground">
                    <span className="text-[11px] font-medium text-primary-600 dark:text-primary-300 bg-primary-500/10 px-2 py-0.5 rounded-md border border-primary-500/20">
                      {`${playbackRate}x`}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </button>
              </div>
            )}

            {/* QUALITY SUBMENU */}
            {settingsTab === 'quality' && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 pb-2 border-b border-card-border/60 mb-1">
                  <button
                    onClick={() => setSettingsTab('main')}
                    className="p-1 rounded-lg hover:bg-slate-800 text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1.5 text-xs font-bold"
                  >
                    <ChevronLeft className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    <span>Quality</span>
                  </button>
                </div>

                <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
                  {videoData?.assets?.map((asset) => {
                    const isSelected = selectedAsset?.slug === asset.slug;
                    return (
                      <button
                        key={asset.slug}
                        onClick={() => {
                          handleQualityChange(asset);
                          setShowSettings(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between font-semibold text-xs touch-manipulation ${
                          isSelected 
                            ? 'text-primary-600 dark:text-primary-400 bg-primary-950/40 border border-primary-500/30 shadow-sm' 
                            : 'text-foreground/80 hover:bg-card/90 active:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-4 h-4 flex items-center justify-center shrink-0">
                            {isSelected && <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                          </div>
                          <span>{asset.displayName}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground bg-card px-1.5 py-0.5 rounded border border-card-border">
                          {(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SPEED SUBMENU */}
            {settingsTab === 'speed' && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 pb-2 border-b border-card-border/60 mb-1">
                  <button
                    onClick={() => setSettingsTab('main')}
                    className="p-1 rounded-lg hover:bg-slate-800 text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1.5 text-xs font-bold"
                  >
                    <ChevronLeft className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    <span>Playback Speed</span>
                  </button>
                </div>

                <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
                  {[
                    { label: '0.5x', rate: 0.5 },
                    { label: '1x', rate: 1 },
                    { label: '1.25x', rate: 1.25 },
                    { label: '1.5x', rate: 1.5 },
                    { label: '1.75x', rate: 1.75 },
                    { label: '2x', rate: 2 },
                  ].map((item) => {
                    const isActive = playbackRate === item.rate;
                    return (
                      <button
                        key={item.rate}
                        onClick={() => {
                          handleSpeedChange(item.rate);
                          setShowSettings(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between font-semibold text-xs touch-manipulation ${
                          isActive 
                            ? 'text-primary-600 dark:text-primary-400 bg-primary-950/40 border border-primary-500/30 shadow-sm' 
                            : 'text-foreground/80 hover:bg-card/90 active:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-4 h-4 flex items-center justify-center shrink-0">
                            {isActive && <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                          </div>
                          <span>{item.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
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
              className="absolute left-0 h-1.5 rounded-full bg-primary-500 group-hover/timeline:h-2.5 transition-all shadow-[0_0_12px_rgba(99,102,241,0.6)]" 
            />

            {scrubHoverTime !== null && (
              <div
                style={{ left: `${scrubHoverPos}%` }}
                className="absolute bottom-6 -translate-x-1/2 bg-card border border-slate-700 px-2 py-1 rounded-md text-[10px] font-mono text-foreground shadow-xl pointer-events-none z-40"
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
              className="absolute inset-x-0 w-full h-full opacity-0 accent-primary-500 cursor-pointer z-20"
              style={{ background: 'none' }}
            />
          </div>

          {/* Buttons & Options Row */}
          <div className="flex items-center justify-between text-foreground gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {prevVideoUrl && (
                <Link
                  href={prevVideoUrl}
                  className="hidden sm:inline-flex p-1.5 sm:p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-foreground hover:text-foreground items-center justify-center"
                  title={prevTitle ? `Previous: ${prevTitle}` : "Previous Video"}
                  aria-label="Previous Video"
                >
                  <SkipBack className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current" />
                </Link>
              )}

              <button
                onClick={handlePlayPause}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-foreground touch-manipulation"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-white" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />}
              </button>

              {nextVideoUrl && (
                <Link
                  href={nextVideoUrl}
                  className="hidden sm:inline-flex p-1.5 sm:p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-foreground hover:text-foreground items-center justify-center"
                  title={nextTitle ? `Next (Shift + →): ${nextTitle}` : "Next Video (Shift + →)"}
                  aria-label="Next Video"
                >
                  <SkipForward className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current" />
                </Link>
              )}

              <span className="text-[10px] sm:text-xs font-mono text-foreground/80 tracking-tight ml-1">
                {formatTime(currentTime)} <span className="text-slate-500">/</span> {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {selectedAsset && (
                <span className="hidden sm:inline-block text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-primary-950/80 border border-primary-500/30 text-primary-600 dark:text-primary-300">
                  {selectedAsset.displayName}
                </span>
              )}

              <button
                onClick={() => setShowSettings(prev => {
                  if (!prev) setSettingsTab('main');
                  return !prev;
                })}
                className={`p-1.5 sm:p-2 rounded-xl hover:bg-white/10 transition-all text-foreground ${showSettings ? 'bg-white/20 text-foreground' : ''}`}
                aria-label="Settings"
              >
                <Settings className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </button>

              {onToggleTheaterMode && (
                <button
                  onClick={onToggleTheaterMode}
                  className={`p-1.5 sm:p-2 rounded-xl hover:bg-white/10 transition-colors hidden sm:inline-flex items-center gap-1 ${isTheaterMode ? 'bg-primary-600/30 text-primary-600 dark:text-primary-300' : 'text-foreground'}`}
                  title="Theater Mode (T)"
                  aria-label="Theater Mode"
                >
                  <RectangleHorizontal className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </button>
              )}

              {document.pictureInPictureEnabled && (
                <button
                  onClick={togglePictureInPicture}
                  className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-foreground transition-colors hidden md:inline-flex"
                  title="Picture-in-Picture"
                >
                  <PictureInPicture2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </button>
              )}

              <button 
                onClick={handleToggleFullscreen} 
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-foreground transition-colors"
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
            className="absolute bottom-16 right-2 sm:right-6 z-40 max-w-[260px] sm:max-w-xs p-3.5 rounded-2xl bg-background/95 border border-primary-500/30 shadow-2xl backdrop-blur-xl animate-in fade-in flex flex-col gap-2 text-left text-foreground"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-primary-600 dark:text-primary-400 tracking-wider">Up Next</span>
                <p className="text-xs font-bold text-foreground line-clamp-1 mt-0.5">{nextTitle || "Next Video"}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Playing in <span className="font-bold text-foreground text-xs">{autoPlayCountdown}s</span>...</p>
              </div>
              <button 
                onClick={() => {
                  setAutoPlayCancelled(true);
                  setShowAutoPlayOverlay(false);
                }}
                className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                title="Cancel Auto-play"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => router.push(nextVideoUrl)}
                className="flex-1 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-xs font-bold text-white transition-colors text-center shadow-lg shadow-primary-600/30"
              >
                Play Now
              </button>
              <button
                onClick={() => {
                  setAutoPlayCancelled(true);
                  setShowAutoPlayOverlay(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-foreground/80 transition-colors"
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

      {/* Player Info/Nav Header — rendered under the video player on mobile and desktop */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-4 sm:px-6 py-3 order-2 border-t border-card-border/60 bg-background/90">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-bold text-foreground truncate">{title || videoData?.name}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {prevVideoUrl && (
            <Link
              href={prevVideoUrl}
              className="text-xs sm:text-sm font-semibold text-foreground hover:text-foreground px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 hover:border-primary-500/50 transition-all flex items-center gap-1.5 touch-manipulation shadow-sm"
              title={prevTitle ? `Previous (Shift + ←): ${prevTitle}` : "Previous Video (Shift + ←)"}
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              <span>Previous</span>
            </Link>
          )}
          {nextVideoUrl && (
            <Link
              href={nextVideoUrl}
              className="text-xs sm:text-sm font-semibold text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-primary-600 hover:bg-primary-500 border border-primary-400/30 transition-all flex items-center gap-1.5 shadow-md shadow-primary-950/50 touch-manipulation"
              title={nextTitle ? `Next (Shift + →): ${nextTitle}` : "Next Video (Shift + →)"}
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4 text-foreground" />
            </Link>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground px-3 py-1.5 sm:py-2 rounded-xl bg-slate-800/80 border border-slate-700/60 transition-all"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
