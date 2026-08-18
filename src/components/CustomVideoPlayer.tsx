'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Tv,
  RotateCcw,
  FastForward,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X
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

  // Playing / Controls State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  
  // Custom Menu Popovers
  const [activeAsset, setActiveAsset] = useState<VideoAsset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<VideoAsset | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'main' | 'quality' | 'speed'>('main');
  const [pendingQualityMessage, setPendingQualityMessage] = useState<string | null>(null);

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
          
          // Read preferred quality from localStorage
          let preferredHeight: number | null = null;
          try {
            const stored = localStorage.getItem('preptea_preferred_quality');
            if (stored) {
              preferredHeight = parseInt(stored, 10);
            }
          } catch (e) {
            // ignore
          }

          // Select default asset matching preferred quality, or fall back
          let defaultAsset = null;
          if (preferredHeight) {
            defaultAsset = video.assets.find((a) => a.height === preferredHeight);
          }

          if (!defaultAsset) {
            defaultAsset =
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

  // If YouTube embed HTML is provided, render YouTube Embed Player
  if (embedHtml) {
    const srcMatch = embedHtml.match(/src=["']([^"']+)["']/i);
    let embedSrc = srcMatch ? srcMatch[1] : '';
    
    // Add autoplay parameter
    if (embedSrc) {
      const sep = embedSrc.includes('?') ? '&' : '?';
      embedSrc += `${sep}autoplay=1`;
    }

    return (
      <div className="w-full space-y-3">
        {/* Player Frame header */}
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-red-400">YouTube Video</span>
            <h3 className="text-sm font-bold text-white truncate">{title || 'YouTube Video'}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {prevVideoUrl && (
              <Link
                href={prevVideoUrl}
                className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </Link>
            )}
            {nextVideoUrl && (
              <Link
                href={nextVideoUrl}
                className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all"
              >
                Close Player
              </button>
            )}
          </div>
        </div>

        {/* Responsive YouTube Embed Container */}
        <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border border-slate-800/80 shadow-2xl">
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

        {/* Bottom Navigation Cards */}
        {(prevVideoUrl || nextVideoUrl) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800/80">
            {prevVideoUrl ? (
              <Link href={prevVideoUrl} className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all flex flex-col items-start text-left gap-1 group w-full">
                <span className="text-[10px] font-extrabold uppercase text-indigo-400">Previous Lesson</span>
                <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">{prevTitle || "Previous"}</span>
              </Link>
            ) : <div />}

            {nextVideoUrl ? (
              <Link href={nextVideoUrl} className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all flex flex-col items-end text-right gap-1 group w-full">
                <span className="text-[10px] font-extrabold uppercase text-indigo-400">Next Lesson</span>
                <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">{nextTitle || "Next"}</span>
              </Link>
            ) : <div />}
          </div>
        )}
      </div>
    );
  }

  // Sync background preloading video element time with main video element
  useEffect(() => {
    if (preloadingAsset && videoRef.current && preloadingVideoRef.current) {
      preloadingVideoRef.current.currentTime = videoRef.current.currentTime;
    }
  }, [preloadingAsset]);

  // 2. Hide controls automatically on mouse idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSettings(false);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // 3. Sync media state
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
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
    
    // Save playback state
    wasPlayingBeforeSwitchRef.current = !videoRef.current.paused;
    pendingSeekTimeRef.current = videoRef.current.currentTime;
    isSwitchingQualityRef.current = true;

    // Update active asset
    setActiveAsset(asset);
    setSelectedAsset(asset);
  };

  const handlePreloadCanPlay = () => {
    if (!preloadingAsset) return;
    
    isPreloadReadyRef.current = true;

    // If there is no pending high-to-low switch, execute the switch immediately!
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

    // Check if we have a pending high-to-low quality switch AND the preload is ready
    if (pendingQualityTargetRef.current && isPreloadReadyRef.current) {
      const { asset, switchTime } = pendingQualityTargetRef.current;
      // Switch when we reach the switchTime (or if we seek past it)
      if (currentTimeVal >= switchTime - 0.5) {
        pendingQualityTargetRef.current = null;
        setPreloadingAsset(null);
        executeQualitySwitch(asset);
      }
    }

    // Auto Play Countdown Check (last 10 seconds of video)
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
    
    // Reset quality switching flag
    isSwitchingQualityRef.current = false;

    // Seek to previous position if we just switched quality
    if (pendingSeekTimeRef.current > 0) {
      videoRef.current.currentTime = pendingSeekTimeRef.current;
      pendingSeekTimeRef.current = 0;
      
      if (wasPlayingBeforeSwitchRef.current) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  // 4. Scrub / Timeline click
  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekTo = parseFloat(e.target.value);
    videoRef.current.currentTime = seekTo;
    setCurrentTime(seekTo);
  };

  // 6. Playback speed control
  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSettings(false);
  };

  // 7. Custom Quality switching with seamless state restoration
  const handleQualityChange = (asset: VideoAsset) => {
    if (!videoRef.current || !activeAsset) return;

    // Update the selected asset state immediately for correct UI selection highlight
    setSelectedAsset(asset);

    // Save preferred quality to localStorage for all future videos
    try {
      localStorage.setItem('preptea_preferred_quality', asset.height.toString());
    } catch (e) {
      // ignore localStorage errors
    }

    const isHighToLow = asset.height < activeAsset.height;

    // Start preloading the new asset in the background
    isPreloadReadyRef.current = false;
    setPreloadingAsset(asset);

    if (isHighToLow) {
      const bufferedEnd = getBufferedEnd(videoRef.current);
      // Wait until current buffer is consumed
      pendingQualityTargetRef.current = { asset, switchTime: bufferedEnd };
    } else {
      // Low to High is immediate (once preloader is ready)
      pendingQualityTargetRef.current = null;
    }
    
    setShowSettings(false);
  };

  // 8. Fullscreen control
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // 9. Format duration string helper
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Keybindings for standard video player shortcuts
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
        case 'arrowright':
          e.preventDefault();
          videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10);
          break;
        case 'arrowleft':
          e.preventDefault();
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  if (loading) {
    return (
      <div className="w-full aspect-video flex flex-col items-center justify-center bg-slate-950 border border-slate-800 rounded-3xl p-6">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-xs text-slate-400 mt-2.5 font-semibold">Loading secure player stream...</p>
      </div>
    );
  }

  if (error || !videoData || !activeAsset) {
    return (
      <div className="w-full aspect-video flex flex-col items-center justify-center bg-slate-950 border border-slate-800 rounded-3xl p-6 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-500" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-white">Video Load Error</p>
          <p className="text-xs text-slate-400 max-w-sm">{error || 'Could not load video source stream.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Player Frame header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-400">Now Watching</span>
          <h3 className="text-sm font-bold text-white truncate">{title || videoData.name}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {prevVideoUrl && (
            <Link
              href={prevVideoUrl}
              className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </Link>
          )}
          {nextVideoUrl && (
            <Link
              href={nextVideoUrl}
              className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all"
            >
              Close Player
            </button>
          )}
        </div>
      </div>

      {/* Main Video Container Frame */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border border-slate-800/80 shadow-2xl group select-none"
      >
        <video
          ref={videoRef}
          src={activeAsset.url}
          className="w-full h-full object-contain cursor-pointer"
          onClick={handlePlayPause}
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

        {/* Pending Quality switch notification */}
        {pendingQualityMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-indigo-500/30 px-3.5 py-1.5 rounded-xl text-[11px] font-semibold text-indigo-300 shadow-xl backdrop-blur-md animate-fade-in z-20 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            <span>{pendingQualityMessage}</span>
          </div>
        )}

        {/* Hover overlay/Controls gradient */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 transition-opacity duration-300 pointer-events-none ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Settings Popover Overlay */}
        {showSettings && (
          <div className="absolute right-4 bottom-14 z-20 w-56 rounded-2xl bg-slate-950/95 border border-slate-800 p-2.5 shadow-xl text-slate-200 text-xs backdrop-blur-xl animate-fade-in">
            {settingsTab === 'main' && (
              <div className="space-y-1">
                <button
                  onClick={() => setSettingsTab('quality')}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-900 transition-all font-semibold"
                >
                  <span>Quality</span>
                  <span className="text-indigo-400 font-bold">{selectedAsset?.displayName || activeAsset?.displayName}</span>
                </button>
                <button
                  onClick={() => setSettingsTab('speed')}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-900 transition-all font-semibold"
                >
                  <span>Speed</span>
                  <span className="text-indigo-400 font-bold">{playbackRate === 1 ? 'Normal' : `${playbackRate}x`}</span>
                </button>
              </div>
            )}

            {settingsTab === 'quality' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-1 px-1 font-bold text-slate-400 text-[10px] uppercase">
                  <span>Select Quality</span>
                  <button onClick={() => setSettingsTab('main')} className="text-indigo-400 hover:text-indigo-300">
                    Back
                  </button>
                </div>
                {videoData.assets.map((asset) => (
                  <button
                    key={asset.slug}
                    onClick={() => handleQualityChange(asset)}
                    className={`w-full text-left p-2 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-between font-semibold ${
                      selectedAsset?.slug === asset.slug ? 'text-indigo-400 bg-indigo-950/20' : ''
                    }`}
                  >
                    <span>{asset.displayName}</span>
                    <span className="text-[10px] text-slate-500">{(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                  </button>
                ))}
              </div>
            )}

            {settingsTab === 'speed' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-1 px-1 font-bold text-slate-400 text-[10px] uppercase">
                  <span>Playback Speed</span>
                  <button onClick={() => setSettingsTab('main')} className="text-indigo-400 hover:text-indigo-300">
                    Back
                  </button>
                </div>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => handleSpeedChange(rate)}
                    className={`w-full text-left p-2 rounded-xl hover:bg-slate-900 transition-all font-semibold ${
                      playbackRate === rate ? 'text-indigo-400 bg-indigo-950/20' : ''
                    }`}
                  >
                    {rate === 1 ? 'Normal (1.0x)' : `${rate}x`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Video Control Bar Panel */}
        <div
          className={`absolute bottom-0 inset-x-0 p-4 flex flex-col gap-3 transition-opacity duration-300 z-10 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Timeline progress scrub line with buffer visualization */}
          <div className="relative w-full h-4 flex items-center group/timeline">
            {/* Background Track */}
            <div className="absolute inset-x-0 h-1 rounded-full bg-slate-800/80 group-hover/timeline:h-1.5 transition-all pointer-events-none" />
            
            {/* Buffered Range Track */}
            <div 
              style={{ width: `${duration > 0 ? (bufferedEnd / duration) * 100 : 0}%` }} 
              className="absolute left-0 h-1 rounded-full bg-slate-600/40 group-hover/timeline:h-1.5 transition-all pointer-events-none" 
            />
            
            {/* Played Range Track */}
            <div 
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} 
              className="absolute left-0 h-1 rounded-full bg-indigo-600 group-hover/timeline:h-1.5 transition-all pointer-events-none" 
            />
            
            {/* Slider Input overlay */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleScrubChange}
              className="absolute inset-x-0 w-full h-full opacity-0 group-hover/timeline:opacity-100 accent-indigo-500 cursor-pointer z-10"
              style={{ background: 'none' }}
            />
          </div>

          {/* Buttons & options row */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              {/* Play / Pause button */}
              <button
                onClick={handlePlayPause}
                className="p-1.5 rounded-xl hover:bg-white/10 transition-colors text-white"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
              </button>

              {/* Live playback position */}
              <span className="text-[11px] font-mono text-slate-300 ml-1.5">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Settings gear toggle */}
              <button
                onClick={() => {
                  setShowSettings(!showSettings);
                  setSettingsTab('main');
                }}
                className={`p-2 rounded-xl hover:bg-white/10 transition-all ${showSettings ? 'bg-white/15' : ''}`}
              >
                <Settings className="w-4.5 h-4.5" />
              </button>

              {/* Maximize / Minimize fullscreen trigger */}
              <button onClick={handleToggleFullscreen} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                <Maximize className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Next Video Auto-Play Countdown Popup */}
        {showAutoPlayOverlay && nextVideoUrl && (
          <div className="absolute bottom-16 right-4 z-20 max-w-xs sm:max-w-sm p-4 rounded-2xl bg-slate-950/95 border border-indigo-500/30 shadow-2xl backdrop-blur-xl animate-fade-in flex flex-col gap-2.5 text-left text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider">Up Next</span>
                <p className="text-xs font-bold text-slate-100 line-clamp-1 mt-0.5">{nextTitle || "Next Lesson"}</p>
                <p className="text-[11px] text-slate-400 mt-1">Playing in <span className="font-bold text-white text-xs">{autoPlayCountdown}s</span>...</p>
              </div>
              <button 
                onClick={() => {
                  setAutoPlayCancelled(true);
                  setShowAutoPlayOverlay(false);
                }}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Cancel Auto-play"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  router.push(nextVideoUrl);
                }}
                className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors text-center"
              >
                Play Now
              </button>
              <button
                onClick={() => {
                  setAutoPlayCancelled(true);
                  setShowAutoPlayOverlay(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Background Preloader Video Element */}
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

      {/* Bottom Navigation Cards */}
      {(prevVideoUrl || nextVideoUrl) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800/80">
          {prevVideoUrl ? (
            <Link href={prevVideoUrl} className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all flex flex-col items-start text-left gap-1 group w-full">
              <span className="text-[10px] font-extrabold uppercase text-indigo-400">Previous Lesson</span>
              <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">{prevTitle || "Previous"}</span>
            </Link>
          ) : <div />}

          {nextVideoUrl ? (
            <Link href={nextVideoUrl} className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all flex flex-col items-end text-right gap-1 group w-full">
              <span className="text-[10px] font-extrabold uppercase text-indigo-400">Next Lesson</span>
              <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">{nextTitle || "Next"}</span>
            </Link>
          ) : <div />}
        </div>
      )}
    </div>
  );
}
