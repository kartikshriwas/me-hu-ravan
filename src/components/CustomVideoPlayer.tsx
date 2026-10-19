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
  SkipForward,
  ArrowDownToLine,
  CheckCircle2,
  Download,
  Trash2,
  ArrowUpRight,
  Camera,
  WifiOff,
} from 'lucide-react';
import { useDownloads } from '@/lib/downloadContext';
import { useAuth } from '@/lib/authContext';
import { checkUserCourseAccess, checkUserIsPremium } from '@/lib/batchAccess';
import { OfflineState } from '@/components/OfflineState';
import { recordVideoCompletionToDb, recordPlaybackProgressToDb, getResumeTimestamp } from '@/lib/userProgressClient';
import { YouTubeDownloadButton } from '@/components/YouTubeDownloadButton';

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
  courseTitle?: string;
  sectionTitle?: string;
  sectionId?: string;
  title?: string;
  embedHtml?: string;
  onClose?: () => void;
  prevVideoUrl?: string;
  nextVideoUrl?: string;
  prevTitle?: string;
  nextTitle?: string;
  isTheaterMode?: boolean;
  onToggleTheaterMode?: () => void;
  blobUrl?: string;
  downloadedQuality?: string;
  onNext?: () => void;
  onPrev?: () => void;
}

export function CustomVideoPlayer({ 
  videoId, 
  courseSlug,
  courseTitle,
  sectionTitle,
  sectionId,
  title, 
  embedHtml,
  onClose, 
  prevVideoUrl, 
  nextVideoUrl,
  prevTitle,
  nextTitle,
  isTheaterMode = false,
  onToggleTheaterMode,
  blobUrl,
  downloadedQuality,
  onNext,
  onPrev,
}: CustomVideoPlayerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const hasCourseAccess = checkUserCourseAccess(user);
  const isPremium = checkUserIsPremium(user);
  const [hasMounted, setHasMounted] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      setIsOnline(navigator.onLine);
    }
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const {
    isDownloaded,
    isDownloading,
    getDownloadProgress,
    startDownload,
    cancelDownload,
    deleteDownload,
    getBlobUrl,
    downloads,
  } = useDownloads();

  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(blobUrl || null);

  const isCurrentDownloaded = isDownloaded(videoId);
  const currentDownload = downloads.find((d) => d.videoId === videoId);
  const effectiveOfflineQuality = downloadedQuality || currentDownload?.quality || null;
  const isPlayingOfflineBlob = !!(blobUrl || localBlobUrl);
  const isCurrentDownloading = isDownloading(videoId);
  const downloadProgress = getDownloadProgress(videoId);

  // Load offline blob URL if downloaded or passed via prop
  useEffect(() => {
    let active = true;
    async function loadOfflineBlob() {
      if (blobUrl) {
        setLocalBlobUrl(blobUrl);
        return;
      }
      if (isCurrentDownloaded) {
        try {
          const url = await getBlobUrl(videoId);
          if (active && url) {
            setLocalBlobUrl(url);
          }
        } catch (e) {
          console.warn('Could not load offline video blob:', e);
        }
      } else {
        setLocalBlobUrl(null);
      }
    }
    loadOfflineBlob();
    return () => {
      active = false;
    };
  }, [videoId, isCurrentDownloaded, getBlobUrl, blobUrl]);

  const [videoData, setVideoData] = useState<WistiaVideoData | null>(null);
  const [loading, setLoading] = useState<boolean>(!embedHtml);
  const [error, setError] = useState<string | null>(null);

  // Playing State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showRemainingTime, setShowRemainingTime] = useState(false);

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
  const [screenshotFlash, setScreenshotFlash] = useState(false);
  const [screenshotNotification, setScreenshotNotification] = useState<string | null>(null);
  const [resumeToast, setResumeToast] = useState<{ time: number; formatted: string } | null>(null);

  // Buffering & Auto-Play states
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showAutoPlayOverlay, setShowAutoPlayOverlay] = useState(false);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState(10);
  const [autoPlayCancelled, setAutoPlayCancelled] = useState(false);

  // Ambient Mode (Glowing dynamic background around player)
  const [ambientMode, setAmbientMode] = useState<boolean>(true);
  const ambientCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    try {
      const savedAmbient = localStorage.getItem('preptea_ambient_mode');
      if (savedAmbient !== null) {
        setAmbientMode(savedAmbient === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleAmbientMode = () => {
    setAmbientMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('preptea_ambient_mode', String(next));
      } catch {}
      return next;
    });
  };

  // Continuous low-overhead canvas render for Ambient Glow
  useEffect(() => {
    if (!ambientMode || isFullscreen) return;

    let animId: number;
    let lastRenderTime = 0;

    const renderGlow = (timestamp: number) => {
      // Limit to ~20 FPS for silky glow without consuming CPU/GPU
      if (timestamp - lastRenderTime > 50) {
        lastRenderTime = timestamp;
        const video = videoRef.current;
        const canvas = ambientCanvasRef.current;
        if (video && canvas && !video.paused && !video.ended && video.readyState >= 2) {
          const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
          if (ctx) {
            try {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            } catch {
              // cross-origin protection if any
            }
          }
        }
      }
      animId = requestAnimationFrame(renderGlow);
    };

    animId = requestAnimationFrame(renderGlow);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [ambientMode, isFullscreen]);
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
  const lastDbSaveTimeRef = useRef<number>(Date.now());
  const hasRestoredTimeRef = useRef<boolean>(false);

  useEffect(() => {
    hasRestoredTimeRef.current = false;
    lastDbSaveTimeRef.current = Date.now();
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

          // If playing an offline/downloaded video, match the downloaded resolution
          if (effectiveOfflineQuality) {
            const parsedOfflineHeight = parseInt(effectiveOfflineQuality.replace(/\D/g, ''), 10);
            if (parsedOfflineHeight) {
              defaultAsset = video.assets.find((a) => a.height === parsedOfflineHeight) || null;
            }
            if (!defaultAsset) {
              defaultAsset = video.assets.find((a) => a.displayName.toLowerCase() === effectiveOfflineQuality.toLowerCase()) || null;
            }
          }

          if (!defaultAsset && preferredHeight) {
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
              video.assets.find((a) => a.height === 720) ||
              video.assets.find((a) => a.height === 1080) ||
              video.assets.find((a) => a.height === 540) ||
              video.assets[0] ||
              null;
          }
          
          setActiveAsset(defaultAsset);
          setSelectedAsset(defaultAsset);
        } else {
          if (!blobUrl && !localBlobUrl) {
            setError(json.error || 'Failed to load video details.');
          }
        }
      } catch (err) {
        if (active && !blobUrl && !localBlobUrl) setError('An error occurred while loading the video.');
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchMetadata();
    return () => {
      active = false;
    };
  }, [videoId, embedHtml, effectiveOfflineQuality]);

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

  // Listen for dynamic playbackRate changes from extensions, keyboard shortcuts, or DOM
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onRateChange = () => {
      const raw = video.playbackRate;
      if (!isNaN(raw) && raw > 0) {
        const clean = Math.round(raw * 100) / 100;
        setPlaybackRate((prev) => (prev !== clean ? clean : prev));
      }
    };

    video.addEventListener('ratechange', onRateChange);
    // Periodically poll (every 300ms) to detect extensions that alter playbackRate directly without standard events
    const interval = setInterval(onRateChange, 300);

    // Sync immediately on mount / source change
    onRateChange();

    return () => {
      video.removeEventListener('ratechange', onRateChange);
      clearInterval(interval);
    };
  }, [blobUrl, localBlobUrl, activeAsset?.url]);

  // Flush latest playback position to MongoDB on page unload, tab switch, or unmount
  useEffect(() => {
    const handleFlushProgress = () => {
      const v = videoRef.current;
      if (!v || !videoId) return;
      const curTime = v.currentTime;
      if (curTime > 3) {
        const elapsedSinceDb = Date.now() - lastDbSaveTimeRef.current;
        if (elapsedSinceDb >= 2000) {
          const deltaSec = Math.max(1, Math.round(elapsedSinceDb / 1000));
          lastDbSaveTimeRef.current = Date.now();
          recordPlaybackProgressToDb(
            videoId,
            courseSlug,
            curTime,
            v.duration || 0,
            title || videoData?.name || 'Video Lesson',
            deltaSec
          );
        }
      }
    };

    window.addEventListener('pagehide', handleFlushProgress);
    window.addEventListener('beforeunload', handleFlushProgress);
    return () => {
      handleFlushProgress();
      window.removeEventListener('pagehide', handleFlushProgress);
      window.removeEventListener('beforeunload', handleFlushProgress);
    };
  }, [videoId, courseSlug, title, videoData?.name]);

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
      setShowControls(false);
      setShowSettings(false);
    }, 2500);
  }, []);

  const handleContainerMouseLeave = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(false);
    setShowSettings(false);
  }, []);

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

  const recordVideoCompletedAndStreak = (vId: string) => {
    try {
      const storedCompleted = localStorage.getItem('preptea_completed_videos');
      const completedList: string[] = storedCompleted ? JSON.parse(storedCompleted) : [];
      if (!completedList.includes(vId)) {
        completedList.push(vId);
        localStorage.setItem('preptea_completed_videos', JSON.stringify(completedList));
      }

      const now = new Date();
      const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const isoTodayStr = now.toISOString().split('T')[0];

      const rawStreak = localStorage.getItem('preptea_learning_streak_data');
      let studyDays: string[] = [];
      if (rawStreak) {
        try {
          const parsed = JSON.parse(rawStreak);
          if (Array.isArray(parsed.studyDays)) studyDays = parsed.studyDays;
        } catch (e) {}
      }
      if (!studyDays.includes(localTodayStr) && !studyDays.includes(isoTodayStr)) {
        studyDays.push(localTodayStr);
        localStorage.setItem('preptea_learning_streak_data', JSON.stringify({ studyDays, lastUpdated: Date.now() }));
      }

      window.dispatchEvent(new Event('preptea_study_update'));
    } catch (e) {
      // ignore
    }

    // Persist completed video and updated streak to MongoDB
    recordVideoCompletionToDb(vId, courseSlug, duration);
  };

  const handleVideoEnded = () => {
    recordVideoCompletedAndStreak(videoId);

    if (onNext) {
      onNext();
      return;
    }
    if (nextVideoUrl && !autoPlayCancelled) {
      router.push(nextVideoUrl);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const currentTimeVal = videoRef.current.currentTime;
    setCurrentTime(currentTimeVal);
    if (isBuffering) setIsBuffering(false);
    handleProgress();

    // Dynamically sync playbackRate while video is playing (detects extensions like Video Speed Controller)
    const rawRate = videoRef.current.playbackRate;
    if (rawRate && rawRate > 0) {
      const cleanRate = Math.round(rawRate * 100) / 100;
      setPlaybackRate((prev) => (prev !== cleanRate ? cleanRate : prev));
    }

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
          recordVideoCompletedAndStreak(videoId);
        }
      } catch (e) {
        // ignore
      }
    }

    // Throttled heartbeat to MongoDB (every 25 seconds while playing)
    // Local progress is continuously saved to localStorage above every 2 seconds.
    if (Date.now() - lastDbSaveTimeRef.current >= 25000 && videoId && currentTimeVal > 3) {
      const deltaSec = Math.round((Date.now() - lastDbSaveTimeRef.current) / 1000);
      lastDbSaveTimeRef.current = Date.now();
      recordPlaybackProgressToDb(
        videoId,
        courseSlug,
        currentTimeVal,
        duration,
        title || videoData?.name || 'Video Lesson',
        deltaSec
      );
    }

    if (pendingQualityTargetRef.current && isPreloadReadyRef.current) {
      const { asset, switchTime } = pendingQualityTargetRef.current;
      if (currentTimeVal >= switchTime - 0.5) {
        pendingQualityTargetRef.current = null;
        setPreloadingAsset(null);
        executeQualitySwitch(asset);
      }
    }

    if ((nextVideoUrl || onNext) && !autoPlayCancelled && duration > 0) {
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

    // If an extension already altered playbackRate, sync from video element; otherwise apply state
    if (videoRef.current.playbackRate && videoRef.current.playbackRate !== 1) {
      const currentRate = Math.round(videoRef.current.playbackRate * 100) / 100;
      setPlaybackRate(currentRate);
    } else {
      videoRef.current.playbackRate = playbackRate;
    }
    isSwitchingQualityRef.current = false;

    if (pendingSeekTimeRef.current > 0) {
      videoRef.current.currentTime = pendingSeekTimeRef.current;
      pendingSeekTimeRef.current = 0;
      if (wasPlayingBeforeSwitchRef.current) {
        videoRef.current.play().catch(() => {});
      }
    } else if (!hasRestoredTimeRef.current) {
      hasRestoredTimeRef.current = true;

      const tryApplyResume = (resumeSec: number, isRemote = false) => {
        const v = videoRef.current;
        if (!v) return;
        const vDur = v.duration || vidDuration || 0;
        if (resumeSec > 5 && (vDur === 0 || resumeSec < vDur - 10)) {
          // Allow seeking if at beginning (< 3s) OR remote progress from Device A is further ahead
          if (v.currentTime < 3 || (isRemote && resumeSec > v.currentTime + 3)) {
            v.currentTime = resumeSec;
            setCurrentTime(resumeSec);
            setResumeToast({
              time: resumeSec,
              formatted: formatTime(Math.floor(resumeSec)),
            });
            setTimeout(() => {
              setResumeToast((curr) => (curr?.time === resumeSec ? null : curr));
            }, 6000);
          }
        }
      };

      // 1. Check local storage first (instant synchronous)
      let foundTime: number | null = null;
      try {
        const saved = localStorage.getItem(`preptea_video_time_${videoId}`);
        if (saved) {
          const val = parseFloat(saved);
          if (!isNaN(val) && val > 5) foundTime = val;
        } else if (courseSlug) {
          const courseSaved = localStorage.getItem(`preptea_last_video_${courseSlug}`);
          if (courseSaved) {
            const parsed = JSON.parse(courseSaved);
            if (parsed.videoId === videoId && parsed.timestamp > 5) {
              foundTime = parsed.timestamp;
            }
          }
        }
      } catch (e) {
        // ignore
      }

      if (foundTime !== null) {
        tryApplyResume(foundTime);
      }

      // 2. Reconcile cloud progress asynchronously for multi-device sync
      getResumeTimestamp(videoId, courseSlug).then((remoteTime) => {
        if (remoteTime !== null && remoteTime > (foundTime || 0)) {
          tryApplyResume(remoteTime, true);
        }
      });
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

  const handleRateChange = () => {
    if (!videoRef.current) return;
    const raw = videoRef.current.playbackRate;
    if (!isNaN(raw) && raw > 0) {
      const clean = Math.round(raw * 100) / 100;
      setPlaybackRate(clean);
    }
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

  const handleTakeScreenshot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    try {
      setScreenshotFlash(true);
      setTimeout(() => setScreenshotFlash(false), 250);

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const timestampSeconds = Math.floor(video.currentTime);
      const timeStr = formatTime(timestampSeconds).replace(/:/g, '-');
      const cleanTitle = (title || videoData?.name || 'lecture')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 35);
      const filename = `${cleanTitle}_${timeStr}.png`;

      canvas.toBlob((blob) => {
        if (!blob) {
          const dataUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }

        setScreenshotNotification(`Captured frame at ${formatTime(timestampSeconds)}`);
        setTimeout(() => setScreenshotNotification(null), 2500);
      }, 'image/png');
    } catch (err) {
      console.warn('Screenshot capture failed:', err);
      setScreenshotNotification('Could not capture frame');
      setTimeout(() => setScreenshotNotification(null), 2500);
    }
  }, [title, videoData?.name]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || (activeEl as HTMLElement)?.isContentEditable;
      if (isInput) return;

      // Shift + Right Arrow: Next Video
      if (e.shiftKey && (e.key === 'ArrowRight' || e.code === 'ArrowRight')) {
        if (onNext) {
          e.preventDefault();
          onNext();
        } else if (nextVideoUrl) {
          e.preventDefault();
          router.push(nextVideoUrl);
        }
        return;
      }

      // Shift + Left Arrow: Previous (Preview) Video
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.code === 'ArrowLeft')) {
        if (onPrev) {
          e.preventDefault();
          onPrev();
        } else if (prevVideoUrl) {
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

  // Has playable video stream source (network or offline blob)
  const hasPlayableSource = !!(blobUrl || localBlobUrl || activeAsset?.url);

  // If not mounted yet and not an iframe embed or direct blob, render consistent SSR loading placeholder
  if (!hasMounted && !embedHtml && !blobUrl) {
    return (
      <div className="w-full aspect-[16/10] sm:aspect-video min-h-[220px] sm:min-h-0 flex flex-col items-center justify-center bg-background/90 border border-card-border/80 rounded-2xl sm:rounded-3xl p-6">
        <Loader2 className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin" />
        <p className="text-xs text-muted-foreground mt-3 font-medium">Loading stream...</p>
      </div>
    );
  }

  // 1. Offline state — applies to all video sources if not stored in local downloads vault
  if (hasMounted && !isOnline && !hasPlayableSource) {
    return (
      <div className="w-full flex flex-col gap-3">
        <div className="relative w-full aspect-[16/10] sm:aspect-video min-h-[240px] sm:min-h-0 bg-black/95 rounded-2xl sm:rounded-3xl overflow-hidden border border-card-border/80 shadow-2xl flex items-center justify-center p-6 order-1">
          <OfflineState
            isPremium={isPremium || hasCourseAccess}
            onRetry={() => {
              if (typeof window !== 'undefined') window.location.reload();
            }}
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-card/60 border border-card-border/80 order-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs sm:text-sm font-bold text-foreground truncate mt-0.5">{title || 'Video Lesson'}</h3>
            {courseTitle && <p className="text-[11px] text-muted-foreground truncate">{courseTitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {prevVideoUrl && (
              <Link
                prefetch={false}
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
                prefetch={false}
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

  // 2. YouTube Embed Renderer fallback
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
                prefetch={false}
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
                prefetch={false}
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

  if (loading && !hasPlayableSource) {
    return (
      <div className="w-full aspect-[16/10] sm:aspect-video min-h-[220px] sm:min-h-0 flex flex-col items-center justify-center bg-background/90 border border-card-border/80 rounded-2xl sm:rounded-3xl p-6">
        <Loader2 className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin" />
        <p className="text-xs text-muted-foreground mt-3 font-medium">Loading stream...</p>
      </div>
    );
  }

  if (!hasPlayableSource && (error || !videoData || !activeAsset)) {
    if (hasMounted && (!isOnline || error?.toLowerCase().includes('offline') || error?.toLowerCase().includes('network') || error?.toLowerCase().includes('failed to fetch'))) {
      return (
        <div className="w-full flex flex-col gap-3">
          <div className="relative w-full aspect-[16/10] sm:aspect-video min-h-[240px] sm:min-h-0 bg-black/95 rounded-2xl sm:rounded-3xl overflow-hidden border border-card-border/80 shadow-2xl flex items-center justify-center p-6 order-1">
            <OfflineState
              isPremium={isPremium || hasCourseAccess}
              onRetry={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-card/60 border border-card-border/80 order-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-foreground truncate mt-0.5">{title || 'Video Lesson'}</h3>
              {courseTitle && <p className="text-[11px] text-muted-foreground truncate">{courseTitle}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(prevVideoUrl || onPrev) && (
                onPrev ? (
                  <button
                    onClick={onPrev}
                    className="text-xs sm:text-sm font-semibold text-foreground hover:text-foreground px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 hover:border-primary-500/50 transition-all flex items-center gap-1.5 touch-manipulation cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                    <span>Previous</span>
                  </button>
                ) : (
                  <Link
                    prefetch={false}
                    href={prevVideoUrl!}
                    className="text-xs sm:text-sm font-semibold text-foreground hover:text-foreground px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 hover:border-primary-500/50 transition-all flex items-center gap-1.5 touch-manipulation"
                  >
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                    <span>Previous</span>
                  </Link>
                )
              )}
              {(nextVideoUrl || onNext) && (
                onNext ? (
                  <button
                    onClick={onNext}
                    className="text-xs sm:text-sm font-semibold text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-primary-600 hover:bg-primary-500 border border-primary-400/30 transition-all flex items-center gap-1.5 shadow-md shadow-primary-950/40 touch-manipulation cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4 text-foreground" />
                  </button>
                ) : (
                  <Link
                    prefetch={false}
                    href={nextVideoUrl!}
                    className="text-xs sm:text-sm font-semibold text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-primary-600 hover:bg-primary-500 border border-primary-400/30 transition-all flex items-center gap-1.5 shadow-md shadow-primary-950/40 touch-manipulation"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4 text-foreground" />
                  </Link>
                )
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 transition-all cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

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
    <div className="w-full flex flex-col relative">
      {/* Video first on mobile (order-first), title below. On desktop title is on top. */}

      {/* Ambient Mode dynamic glowing background — seamlessly covers video and nav header */}
      {ambientMode && !isFullscreen && (
        <div
          aria-hidden="true"
          className="absolute -inset-4 sm:-inset-6 lg:-inset-8 pointer-events-none overflow-hidden blur-3xl opacity-45 dark:opacity-55 transition-opacity duration-700 -z-10 select-none"
        >
          <canvas
            ref={ambientCanvasRef}
            width={80}
            height={45}
            className="w-full h-full object-cover scale-110 saturate-150 transform-gpu"
          />
        </div>
      )}

      {/* Main Video Container — full bleed */}
      <div
        ref={containerRef}
        onMouseMove={resetControlsTimeout}
        onMouseEnter={resetControlsTimeout}
        onMouseLeave={handleContainerMouseLeave}
        onClick={handleContainerTap}
        className={`relative w-full aspect-video min-h-[200px] sm:min-h-0 bg-black overflow-hidden shadow-2xl group select-none touch-none order-1 ${
          !showControls && isPlaying ? 'cursor-none' : ''
        }`}
      >
        <video
          ref={videoRef}
          src={blobUrl || localBlobUrl || activeAsset?.url}
          crossOrigin="anonymous"
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
          className="w-full h-full object-contain cursor-pointer transition-all"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onProgress={handleProgress}
          onEnded={handleVideoEnded}
          onRateChange={handleRateChange}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          onSeeked={() => setIsBuffering(false)}
          onPlay={() => {
            setIsPlaying(true);
            setIsBuffering(false);
            if (videoRef.current?.playbackRate) {
              const cleanRate = Math.round(videoRef.current.playbackRate * 100) / 100;
              setPlaybackRate((prev) => (prev !== cleanRate ? cleanRate : prev));
            }
          }}
          onPause={() => {
            if (isSwitchingQualityRef.current) return;
            setIsPlaying(false);
            if (videoId && currentTime > 3) {
              const elapsedSinceDb = Date.now() - lastDbSaveTimeRef.current;
              if (elapsedSinceDb >= 3000) {
                const deltaSec = Math.max(1, Math.round(elapsedSinceDb / 1000));
                lastDbSaveTimeRef.current = Date.now();
                recordPlaybackProgressToDb(
                  videoId,
                  courseSlug,
                  currentTime,
                  duration,
                  title || videoData?.name || 'Video Lesson',
                  deltaSec
                );
              }
            }
          }}
          autoPlay
          playsInline
        />

        {/* Screenshot Flash Shutter Effect */}
        {screenshotFlash && (
          <div className="absolute inset-0 bg-white/40 pointer-events-none z-50 transition-opacity duration-200" />
        )}

        {/* Screenshot Notification Badge */}
        {screenshotNotification && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-slate-900/95 border border-primary-500/50 shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-semibold text-white pointer-events-none animate-in fade-in zoom-in-95">
            <Camera className="w-4 h-4 text-primary-400 shrink-0" />
            <span>{screenshotNotification}</span>
          </div>
        )}

        {/* Cross-Device / Auto-Resume Toast */}
        {resumeToast && (
          <div className="absolute top-4 left-4 z-40 bg-slate-900/95 border border-primary-500/40 text-white px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2 sm:gap-2.5 text-xs animate-in fade-in slide-in-from-top-2">
            <RotateCcw className="w-3.5 h-3.5 text-primary-400 shrink-0" />
            <span className="font-medium text-[11px] sm:text-xs">
              Resumed at <strong className="text-primary-300 font-mono font-bold">{resumeToast.formatted}</strong>
            </span>
            <div className="h-3 w-px bg-white/20 mx-0.5" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  setCurrentTime(0);
                }
                setResumeToast(null);
              }}
              className="text-primary-400 hover:text-primary-300 font-bold text-[11px] sm:text-xs transition-colors cursor-pointer hover:underline"
            >
              Start over
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setResumeToast(null);
              }}
              className="text-slate-400 hover:text-white p-0.5 ml-0.5 transition-colors cursor-pointer"
              aria-label="Dismiss resume notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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

        {/* Buffering Spinner & Connection Status */}
        {isBuffering && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20 bg-black/30 backdrop-blur-[2px] transition-all animate-in fade-in">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-900/85 border border-primary-500/40 backdrop-blur-md flex items-center justify-center shadow-2xl">
              <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 text-primary-400 animate-spin" />
            </div>
            {!isOnline && !blobUrl && !localBlobUrl && (
              <div className="mt-3 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-amber-500/40 backdrop-blur-md flex items-center gap-2 text-xs font-semibold text-amber-300 shadow-xl animate-in fade-in slide-in-from-bottom-2">
                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Waiting for internet connection...</span>
              </div>
            )}
          </div>
        )}

        {/* Centered Play/Pause Toggle Button — Modern ultra-clean low opacity glass */}
        {showControls && !isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPause();
              }}
              className="pointer-events-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/10 hover:bg-black/25 border border-white/10 text-white/90 hover:text-white flex items-center justify-center backdrop-blur-[2px] shadow-sm hover:scale-110 active:scale-95 transition-all duration-200 group/centerbtn cursor-pointer"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current stroke-none drop-shadow-md group-hover/centerbtn:scale-105 transition-transform" />
              ) : (
                <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current stroke-none ml-1 drop-shadow-md group-hover/centerbtn:scale-105 transition-transform" />
              )}
            </button>
          </div>
        )}

        {/* Controls Gradient Mask */}
        {/* <div
          className={`absolute inset-0 bg-gradient-to-t from-slate-950/95 via-transparent to-slate-950/40 transition-opacity duration-300 pointer-events-none ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        /> */}

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
                  onClick={() => {
                    if (videoRef.current?.playbackRate) {
                      const cleanRate = Math.round(videoRef.current.playbackRate * 100) / 100;
                      setPlaybackRate((prev) => (prev !== cleanRate ? cleanRate : prev));
                    }
                    setSettingsTab('speed');
                  }}
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

                {/* Ambient Mode Toggle */}
                <button
                  onClick={toggleAmbientMode}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-card/90 active:bg-slate-800 transition-all text-xs font-semibold text-foreground touch-manipulation group"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    <span>Ambient Lighting</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 flex items-center ${
                        ambientMode ? 'bg-primary-600 justify-end' : 'bg-slate-700 justify-start'
                      }`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                    </div>
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
                  {isPlayingOfflineBlob && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-semibold text-xs flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Playing Offline ({effectiveOfflineQuality || 'Saved'})</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        Storage
                      </span>
                    </div>
                  )}

                  {videoData?.assets?.map((asset) => {
                    const isSelected = !isPlayingOfflineBlob && selectedAsset?.slug === asset.slug;
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
                  {![0.5, 1, 1.25, 1.5, 1.75, 2].includes(playbackRate) && (
                    <div className="w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between font-semibold text-xs text-primary-600 dark:text-primary-400 bg-primary-950/40 border border-primary-500/30 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        </div>
                        <span>Custom ({playbackRate}x)</span>
                      </div>
                    </div>
                  )}

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
          className={`absolute bottom-0 inset-x-0 pt-8 sm:pt-12 pb-2.5 sm:pb-3.5 px-2.5 sm:px-4 flex flex-col gap-1.5 sm:gap-2 transition-all duration-300 z-30 bg-gradient-to-t from-black/85 via-black/45 to-transparent backdrop-blur-[6px] ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
          style={{
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)',
            maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)',
          }}
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
              className="absolute left-0 h-1.5 rounded-full bg-primary-500 group-hover/timeline:h-2.5 transition-all" 
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
          <div className="flex items-center justify-between text-white gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={handlePlayPause}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 active:scale-95 transition-all text-white touch-manipulation"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-white" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />}
              </button>   {(prevVideoUrl || onPrev) && (
                onPrev ? (
                  <button
                    onClick={onPrev}
                    className="hidden sm:inline-flex p-1.5 sm:p-2 rounded-xl hover:bg-white/15 active:scale-95 transition-all text-white hover:text-white items-center justify-center cursor-pointer"
                    title={prevTitle ? `Previous: ${prevTitle}` : "Previous Video"}
                    aria-label="Previous Video"
                  >
                    <SkipBack className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current" />
                  </button>
                ) : (
                  <Link
                    prefetch={false}
                    href={prevVideoUrl!}
                    className="hidden sm:inline-flex p-1.5 sm:p-2 rounded-xl hover:bg-white/15 active:scale-95 transition-all text-white hover:text-white items-center justify-center"
                    title={prevTitle ? `Previous: ${prevTitle}` : "Previous Video"}
                    aria-label="Previous Video"
                  >
                    <SkipBack className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current" />
                  </Link>
                )
              )}

              {(nextVideoUrl || onNext) && (
                onNext ? (
                  <button
                    onClick={onNext}
                    className="hidden sm:inline-flex p-1.5 sm:p-2 rounded-xl hover:bg-white/15 active:scale-95 transition-all text-white hover:text-white items-center justify-center cursor-pointer"
                    title={nextTitle ? `Next: ${nextTitle}` : "Next Video"}
                    aria-label="Next Video"
                  >
                    <SkipForward className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current" />
                  </button>
                ) : (
                  <Link
                    prefetch={false}
                    href={nextVideoUrl!}
                    className="hidden sm:inline-flex p-1.5 sm:p-2 rounded-xl hover:bg-white/15 active:scale-95 transition-all text-white hover:text-white items-center justify-center"
                    title={nextTitle ? `Next (Shift + →): ${nextTitle}` : "Next Video (Shift + →)"}
                    aria-label="Next Video"
                  >
                    <SkipForward className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current" />
                  </Link>
                )
              )}

              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRemainingTime((prev) => !prev);
                }}
                className="text-[10px] sm:text-xs font-mono text-white/90 hover:text-white tracking-tight ml-1 cursor-pointer select-none transition-colors"
                title={showRemainingTime ? "Click to show elapsed time" : "Click to show remaining time"}
              >
                {showRemainingTime
                  ? `-${formatTime(Math.max(0, duration - currentTime))}`
                  : formatTime(currentTime)}{' '}
                <span className="text-white/50">/</span> {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {/* Quality button — clicking opens the quality menu directly */}
              {(() => {
                const label = isPlayingOfflineBlob && effectiveOfflineQuality
                  ? effectiveOfflineQuality
                  : (selectedAsset ? selectedAsset.displayName : (videoData?.assets && videoData.assets.length > 0 ? 'HD' : (isPlayingOfflineBlob ? 'Offline' : null)));
                if (!label) return null;
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSettings((prev) => {
                        if (prev && settingsTab === 'quality') {
                          return false;
                        }
                        setSettingsTab('quality');
                        return true;
                      });
                    }}
                    className={`text-[10px] sm:text-xs font-bold tracking-wider uppercase px-2 py-0.5 sm:py-1 rounded-md border transition-all active:scale-95 cursor-pointer ${
                      showSettings && settingsTab === 'quality'
                        ? 'bg-primary-600 text-white border-primary-400 shadow-sm'
                        : 'bg-primary-950/80 border-primary-500/30 text-primary-600 dark:text-primary-300 hover:bg-primary-900/70 hover:border-primary-400/50'
                    }`}
                    title={isPlayingOfflineBlob ? `Offline Quality: ${label} — Click to open quality menu` : "Quality — Click to open quality menu"}
                    aria-label="Quality settings"
                  >
                    {label}
                  </button>
                );
              })()}

              {/* Screenshot button — right side of quality option */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTakeScreenshot();
                }}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 active:scale-95 transition-all text-white hover:text-primary-300"
                title="Take Screenshot"
                aria-label="Take Screenshot"
              >
                <Camera className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (videoRef.current?.playbackRate) {
                    const cleanRate = Math.round(videoRef.current.playbackRate * 100) / 100;
                    setPlaybackRate((prev) => (prev !== cleanRate ? cleanRate : prev));
                  }
                  setShowSettings((prev) => {
                    if (!prev) setSettingsTab('main');
                    return !prev;
                  });
                }}
                className={`p-1.5 sm:p-2 rounded-xl hover:bg-white/15 transition-all text-white ${showSettings && settingsTab !== 'quality' ? 'bg-white/25 text-white' : ''}`}
                aria-label="Settings"
                title="Settings"
              >
                <Settings className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </button>

              {onToggleTheaterMode && (
                <button
                  onClick={onToggleTheaterMode}
                  className={`p-1.5 sm:p-2 rounded-xl transition-colors hidden sm:inline-flex items-center gap-1 bg-transparent ${isTheaterMode ? 'text-primary-400 hover:text-primary-300' : 'text-white/90 hover:text-white hover:bg-white/15'}`}
                  title="Theater Mode (T)"
                  aria-label="Theater Mode"
                >
                  <RectangleHorizontal className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </button>
              )}

              {hasMounted && typeof document !== 'undefined' && document.pictureInPictureEnabled && (
                <button
                  onClick={togglePictureInPicture}
                  className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 text-white transition-colors hidden md:inline-flex"
                  title="Picture-in-Picture"
                >
                  <PictureInPicture2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </button>
              )}

              <button 
                onClick={handleToggleFullscreen} 
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 text-white transition-colors"
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
                onClick={() => {
                  if (onNext) {
                    onNext();
                  } else if (nextVideoUrl) {
                    router.push(nextVideoUrl);
                  }
                }}
                className="flex-1 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-xs font-bold text-white transition-colors text-center shadow-lg shadow-primary-600/30 cursor-pointer"
              >
                Play Now
              </button>
              <button
                onClick={() => {
                  setAutoPlayCancelled(true);
                  setShowAutoPlayOverlay(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-foreground/80 transition-colors cursor-pointer"
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
      <div className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-4 sm:px-6 py-3 order-2 border-t transition-colors duration-500 relative ${
        ambientMode && !isFullscreen
          ? 'bg-background/60 dark:bg-black/5 backdrop-blur-xl border-white/10 dark:border-white/5'
          : 'bg-background/90 border-card-border/60'
      }`}>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
              {title || videoData?.name || 'Video Lesson'}
            </h3>
            {localBlobUrl && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 shrink-0">
                <CheckCircle2 className="w-3 h-3" />
                <span>Offline Ready</span>
              </span>
            )}
          </div>
          {courseTitle && (
            <p className="text-xs text-muted-foreground truncate">{courseTitle}</p>
          )}
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-2 shrink-0">
          {/* YouTube-style Download Action Button — visible only if user has course access */}
          {!embedHtml && hasCourseAccess && (
            <YouTubeDownloadButton
              videoId={videoId}
              courseSlug={courseSlug || 'course'}
              courseTitle={courseTitle || 'Course Batch'}
              sectionTitle={sectionTitle}
              sectionId={sectionId}
              unitTitle={title || videoData?.name || 'Video Lesson'}
              thumbnailUrl={videoData?.thumbnailUrl || ''}
              durationSeconds={videoData?.durationSeconds || duration || 0}
              availableAssets={videoData?.assets}
            />
          )}

          {(prevVideoUrl || onPrev) && (
            onPrev ? (
              <button
                onClick={onPrev}
                className="text-xs sm:text-sm font-semibold text-foreground hover:text-foreground px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 hover:border-primary-500/50 transition-all flex items-center gap-1.5 touch-manipulation shadow-sm cursor-pointer"
                title={prevTitle ? `Previous: ${prevTitle}` : "Previous Video"}
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                <span>Previous</span>
              </button>
            ) : (
              <Link
                prefetch={false}
                href={prevVideoUrl!}
                className="text-xs sm:text-sm font-semibold text-foreground hover:text-foreground px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 hover:border-primary-500/50 transition-all flex items-center gap-1.5 touch-manipulation shadow-sm"
                title={prevTitle ? `Previous (Shift + ←): ${prevTitle}` : "Previous Video (Shift + ←)"}
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                <span>Previous</span>
              </Link>
            )
          )}
          {(nextVideoUrl || onNext) && (
            onNext ? (
              <button
                onClick={onNext}
                className="text-xs sm:text-sm font-semibold text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-primary-600 hover:bg-primary-500 border border-primary-400/30 transition-all flex items-center gap-1.5 shadow-md shadow-primary-950/50 touch-manipulation cursor-pointer"
                title={nextTitle ? `Next: ${nextTitle}` : "Next Video"}
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 text-foreground" />
              </button>
            ) : (
              <Link
                prefetch={false}
                href={nextVideoUrl!}
                className="text-xs sm:text-sm font-semibold text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-primary-600 hover:bg-primary-500 border border-primary-400/30 transition-all flex items-center gap-1.5 shadow-md shadow-primary-950/50 touch-manipulation"
                title={nextTitle ? `Next (Shift + →): ${nextTitle}` : "Next Video (Shift + →)"}
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 text-foreground" />
              </Link>
            )
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground px-3 py-1.5 sm:py-2 rounded-xl bg-slate-800/80 border border-slate-700/60 transition-all cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
