'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  OfflineVideoMetadata,
  getAllDownloadedVideos,
  getDownloadedVideoBlob,
  saveDownloadedVideo,
  deleteDownloadedVideo,
  deleteCourseDownloadedVideos,
  deleteSectionDownloadedVideos,
  clearAllDownloadedVideos,
  getOfflineStorageUsage,
} from './videoStorage';
import { useAuth } from '@/lib/authContext';
import {
  checkUserCourseAccess,
  checkCanDownload,
  verifyAndGetCachedBatchAccess,
  saveCachedBatchAccess,
} from '@/lib/batchAccess';
import { findBestMatchingAsset, matchQualityWithFallback, getRememberedQuality } from '@/lib/qualityMatcher';

export type DownloadStatusType = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';

export interface StartDownloadParams {
  videoId: string;
  courseSlug: string;
  courseTitle: string;
  sectionTitle?: string;
  sectionId?: string;
  unitTitle: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  quality?: string;
  assetUrl?: string;
  expectedSizeBytes?: number;
}

export interface DownloadingStatus {
  status: DownloadStatusType;
  progress: number;
  quality: string;
  bytesReceived: number;
  totalBytes: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  unitTitle?: string;
  courseSlug?: string;
  courseTitle?: string;
  sectionTitle?: string;
  sectionId?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  assetUrl?: string;
  error?: string;
  qualityFallbackNotice?: {
    requestedQuality: string;
    actualQuality: string;
    availableQualities: string[];
  };
}

export interface BatchDownloadProgress {
  batchId: string;
  type: 'course' | 'section';
  title: string;
  courseSlug: string;
  courseTitle: string;
  sectionTitle?: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  isDownloading: boolean;
  currentVideoTitle?: string;
  quality?: string;
}

interface DownloadContextType {
  downloads: OfflineVideoMetadata[];
  downloadedIds: Set<string>;
  downloadingMap: Record<string, DownloadingStatus>;
  storageUsage: { usedBytes: number; count: number; quotaBytes?: number; quotaUsedBytes?: number };
  batchProgress: BatchDownloadProgress | null;

  // Status queries
  isDownloaded: (videoId: string) => boolean;
  isDownloading: (videoId: string) => boolean;
  isQueued: (videoId: string) => boolean;
  isPaused: (videoId: string) => boolean;
  isFailed: (videoId: string) => boolean;
  retryDownload: (videoId: string) => Promise<void>;
  getDownloadProgress: (videoId: string) => number | undefined;
  getDownloadStatus: (videoId: string) => DownloadingStatus | undefined;
  isSectionDownloaded: (courseSlug: string, sectionTitle: string, totalCount?: number) => boolean;
  isSectionDownloading: (courseSlug: string, sectionTitle: string) => boolean;
  getSectionDownloadedCount: (courseSlug: string, sectionTitle: string) => number;
  isCourseDownloaded: (courseSlug: string, totalCount?: number) => boolean;
  isCourseDownloading: (courseSlug: string) => boolean;
  getCourseDownloadedCount: (courseSlug: string) => number;

  // Actions
  startDownload: (params: StartDownloadParams) => Promise<void>;
  pauseDownload: (videoId: string) => void;
  resumeDownload: (videoId: string) => void;
  cancelDownload: (videoId: string) => void;
  pauseAllDownloads: () => void;
  resumeAllDownloads: () => void;
  downloadSection: (params: {
    courseSlug: string;
    courseTitle: string;
    sectionTitle: string;
    sectionId?: string;
    preferredQuality?: string;
    units: { videoId: string; unitTitle: string; duration?: number }[];
  }) => Promise<void>;
  downloadCourse: (params: {
    courseSlug: string;
    courseTitle: string;
    preferredQuality?: string;
    sections: {
      sectionTitle: string;
      sectionId?: string;
      units: { videoId: string; unitTitle: string; duration?: number }[];
    }[];
  }) => Promise<void>;
  cancelBatchDownload: () => void;
  deleteDownload: (videoId: string) => Promise<void>;
  deleteSectionDownloads: (courseSlug: string, sectionTitle: string) => Promise<void>;
  deleteCourseDownloads: (courseSlug: string) => Promise<void>;
  clearAllDownloads: () => Promise<void>;
  getBlobUrl: (videoId: string) => Promise<string | null>;
  revokeBlobUrl: (url: string) => void;
  refreshDownloads: () => Promise<void>;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [downloads, setDownloads] = useState<OfflineVideoMetadata[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [downloadingMap, setDownloadingMap] = useState<Record<string, DownloadingStatus>>({});
  const [batchProgress, setBatchProgress] = useState<BatchDownloadProgress | null>(null);
  const [storageUsage, setStorageUsage] = useState<{
    usedBytes: number;
    count: number;
    quotaBytes?: number;
    quotaUsedBytes?: number;
  }>({
    usedBytes: 0,
    count: 0,
  });

  // Reference trackers to avoid React stale closure issues in the queue loop
  const queueRef = useRef<string[]>([]);
  const activeVideoIdRef = useRef<string | null>(null);
  const downloadParamsRef = useRef<Map<string, StartDownloadParams>>(new Map());
  const partialChunksRef = useRef<Map<string, { chunks: Uint8Array[]; bytesReceived: number; totalBytes: number }>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const downloadingMapRef = useRef<Record<string, DownloadingStatus>>({});
  const activeBlobUrlsRef = useRef<Map<string, string>>(new Map());
  const isWorkerBusyRef = useRef<boolean>(false);
  const batchCancelRef = useRef<boolean>(false);

  // Keep downloadingMapRef in sync
  useEffect(() => {
    downloadingMapRef.current = downloadingMap;
  }, [downloadingMap]);

  const { user, loading: authLoading } = useAuth();

  // Load downloads from IndexedDB on initial mount
  const refreshDownloads = useCallback(async () => {
    try {
      const items = await getAllDownloadedVideos();
      setDownloads(items);
      setDownloadedIds(new Set(items.map((i) => i.videoId)));
      const usage = await getOfflineStorageUsage();
      setStorageUsage(usage);
    } catch (err) {
      console.warn('Could not load offline downloads from IndexedDB:', err);
    }
  }, []);

  useEffect(() => {
    refreshDownloads();
  }, [refreshDownloads]);

  // Synchronize user batch access & purge offline downloads if access was revoked
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const verifyAndSyncAccess = async () => {
      if (authLoading) return;

      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) return;

      const cached = await verifyAndGetCachedBatchAccess();

      if (user && user.email) {
        const liveAccess = checkUserCourseAccess(user);
        const canDownload = checkCanDownload(user);

        // Requirement: If user premium ended and they have anything in downloads, clean everything from downloads
        const isExpired = user.premiumExpiresAt && new Date(user.premiumExpiresAt).getTime() <= Date.now();
        const isNonPremium = !canDownload || isExpired || !user.isPremium;

        if (isNonPremium) {
          try {
            const currentOffline = await getAllDownloadedVideos();
            if (currentOffline && currentOffline.length > 0) {
              console.warn('PrepTea Security: Premium ended or not active. Purging all offline downloads...');
              await clearAllDownloadedVideos();
              setDownloads([]);
              setDownloadedIds(new Set());
              setStorageUsage({ usedBytes: 0, count: 0 });
              saveCachedBatchAccess(user.email, false, []);
              return;
            }
          } catch {
            // ignore
          }
        }

        if (cached && cached.email === user.email.toLowerCase().trim() && cached.hasAccess && !liveAccess) {
          console.warn('PrepTea Security: Course access revoked. Purging local downloads...');
          await clearAllDownloadedVideos();
          setDownloads([]);
          setDownloadedIds(new Set());
          setStorageUsage({ usedBytes: 0, count: 0 });
          saveCachedBatchAccess(user.email, false, []);
          return;
        }

        if (liveAccess && canDownload) {
          saveCachedBatchAccess(user.email, true, user.allowedBatches || [], '');
        } else {
          saveCachedBatchAccess(user.email, false, [], '');
        }
      }
    };

    verifyAndSyncAccess();
    const handleOnline = () => verifyAndSyncAccess();
    window.addEventListener('online', handleOnline);

    // Also listen for demo-expired event to immediately clean downloads
    const handleDemoExpired = async () => {
      try {
        console.warn('PrepTea Security: Demo expired. Purging all downloaded videos...');
        await clearAllDownloadedVideos();
        setDownloads([]);
        setDownloadedIds(new Set());
        setStorageUsage({ usedBytes: 0, count: 0 });
        if (user?.email) {
          saveCachedBatchAccess(user.email, false, []);
        }
      } catch (err) {
        console.error('Failed to clear downloads on demo expiration:', err);
      }
    };
    window.addEventListener('preptea:demo-expired', handleDemoExpired);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('preptea:demo-expired', handleDemoExpired);
    };
  }, [user, authLoading]);

  // Clean up object URLs on window unload
  useEffect(() => {
    return () => {
      activeBlobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
      activeBlobUrlsRef.current.clear();
    };
  }, []);

  // Helper to fetch video metadata if assetUrl is missing, respecting preferred quality
  const resolveVideoAsset = useCallback(async (videoId: string, preferredQuality?: string) => {
    try {
      const res = await fetch(`/api/video/${videoId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json?.success || !json.video) throw new Error('Video data not found');
      const { video } = json;
      const assets = video.assets || [];

      const targetQuality = preferredQuality || getRememberedQuality('720p');
      // Find the best quality matching the user's preference, prioritizing higher resolution if requested is missing
      const matchResult = matchQualityWithFallback(assets, targetQuality);
      const chosen: any = matchResult?.asset;

      if (!chosen?.url) throw new Error('No downloadable MP4 asset found');

      const rawLabel = (chosen.displayName || '').trim();
      const isOriginal = rawLabel.toLowerCase().includes('original');
      const qualityLabel = (!isOriginal && rawLabel) ? rawLabel : (chosen.height ? `${chosen.height}p` : (targetQuality || '720p'));

      const fallbackNotice = (!matchResult?.isExact && matchResult && matchResult.requestedQuality !== qualityLabel) ? {
        requestedQuality: matchResult.requestedQuality,
        actualQuality: qualityLabel,
        availableQualities: matchResult.availableQualities,
      } : undefined;

      return {
        assetUrl: chosen.url as string,
        quality: qualityLabel,
        expectedSizeBytes: chosen.sizeBytes,
        thumbnailUrl: video.thumbnailUrl || '',
        durationSeconds: video.durationSeconds || 0,
        unitTitle: video.name || '',
        fallbackNotice,
      };
    } catch (err: any) {
      console.error(`Failed to resolve asset for video ${videoId}:`, err);
      return null;
    }
  }, []);

  // =========================================================================
  // CENTRAL YOUTUBE-STYLE DOWNLOAD QUEUE WORKER
  // Concurrency: 1 (Sequential background worker with HTTP Range resumption)
  // =========================================================================
  const processQueue = useCallback(async () => {
    if (isWorkerBusyRef.current) return;
    if (activeVideoIdRef.current !== null) return;

    // Find next pending video in queue whose status is 'queued' or 'downloading'
    let nextVideoId: string | null = null;
    for (const vId of queueRef.current) {
      const current = downloadingMapRef.current[vId];
      if (!current || current.status === 'queued' || current.status === 'downloading') {
        nextVideoId = vId;
        break;
      }
    }

    if (!nextVideoId) return;

    const params = downloadParamsRef.current.get(nextVideoId);
    if (!params) {
      queueRef.current = queueRef.current.filter((id) => id !== nextVideoId);
      setTimeout(() => processQueue(), 50);
      return;
    }

    isWorkerBusyRef.current = true;
    activeVideoIdRef.current = nextVideoId;

    const abortController = new AbortController();
    abortControllersRef.current.set(nextVideoId, abortController);

    // Update status to 'downloading'
    downloadingMapRef.current = {
      ...downloadingMapRef.current,
      [nextVideoId]: {
        ...(downloadingMapRef.current[nextVideoId] || {}),
        status: 'downloading',
        error: undefined,
      } as DownloadingStatus,
    };

    setDownloadingMap((prev) => {
      if (!prev[nextVideoId!]) return prev;
      return {
        ...prev,
        [nextVideoId!]: {
          ...prev[nextVideoId!],
          status: 'downloading',
          error: undefined,
        },
      };
    });

    try {
      let assetUrl = params.assetUrl;
      let quality = params.quality || '720p';
      let expectedSizeBytes = params.expectedSizeBytes;
      let thumbnailUrl = params.thumbnailUrl;
      let durationSeconds = params.durationSeconds;
      let unitTitle = params.unitTitle;

      let qualityFallbackNotice: any = undefined;

      if (!assetUrl) {
        const resolved = await resolveVideoAsset(nextVideoId, quality);
        if (!resolved) throw new Error('Video stream unavailable');
        assetUrl = resolved.assetUrl;
        quality = resolved.quality;
        expectedSizeBytes = resolved.expectedSizeBytes;
        qualityFallbackNotice = resolved.fallbackNotice;
        if (!thumbnailUrl) thumbnailUrl = resolved.thumbnailUrl;
        if (!durationSeconds) durationSeconds = resolved.durationSeconds;
        if (!unitTitle) unitTitle = resolved.unitTitle;

        if (qualityFallbackNotice) {
          setDownloadingMap((prev) => {
            if (!prev[nextVideoId!]) return prev;
            return {
              ...prev,
              [nextVideoId!]: {
                ...prev[nextVideoId!],
                quality,
                qualityFallbackNotice,
              },
            };
          });
        }
      }

      // Check for partial chunks (YouTube resumable downloads)
      const partial = partialChunksRef.current.get(nextVideoId);
      const existingChunks = partial?.chunks ? [...partial.chunks] : [];
      let bytesReceived = partial ? partial.bytesReceived : 0;
      let totalBytes = partial ? partial.totalBytes : (expectedSizeBytes || 0);

      // Prepare request headers with Range if resuming
      const requestHeaders: Record<string, string> = {};
      if (bytesReceived > 0) {
        requestHeaders['Range'] = `bytes=${bytesReceived}-`;
      }

      let response: Response | null = null;
      try {
        response = await fetch(assetUrl, {
          headers: requestHeaders,
          signal: abortController.signal,
        });
      } catch (err: any) {
        if (abortController.signal.aborted) throw err;
        console.warn('Direct fetch failed, falling back to proxy stream:', err);
      }

      if (!response || !response.ok) {
        const proxyUrl = `/api/video/download-stream?url=${encodeURIComponent(assetUrl)}`;
        response = await fetch(proxyUrl, {
          headers: requestHeaders,
          signal: abortController.signal,
        });
      }

      if (!response.ok || !response.body) {
        throw new Error(`Failed to download stream: HTTP ${response.status}`);
      }

      // Handle Range acceptance (206 Partial Content)
      if (response.status === 206) {
        const contentRange = response.headers.get('content-range');
        if (contentRange) {
          const match = contentRange.match(/\/(\d+)/);
          if (match) totalBytes = parseInt(match[1], 10);
        }
      } else if (response.status === 200 && bytesReceived > 0) {
        // Server did not support Range, restart buffer cleanly
        existingChunks.length = 0;
        bytesReceived = 0;
        const cl = response.headers.get('content-length');
        if (cl) totalBytes = parseInt(cl, 10);
      } else {
        const cl = response.headers.get('content-length');
        if (cl) totalBytes = parseInt(cl, 10);
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = existingChunks;
      let lastReportTime = Date.now();
      let lastBytes = bytesReceived;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          bytesReceived += value.length;

          const now = Date.now();
          if (now - lastReportTime > 150 || bytesReceived === totalBytes) {
            const timeDelta = (now - lastReportTime) / 1000;
            const bytesDelta = bytesReceived - lastBytes;
            const speed = timeDelta > 0 ? Math.round(bytesDelta / timeDelta) : 0;
            const remainingBytes = Math.max(0, totalBytes - bytesReceived);
            const eta = speed > 0 ? Math.round(remainingBytes / speed) : undefined;

            lastReportTime = now;
            lastBytes = bytesReceived;

            const progress = totalBytes > 0 ? Math.min(99, Math.round((bytesReceived / totalBytes) * 100)) : 50;

            // Preserve chunks for pause / disconnect recovery
            partialChunksRef.current.set(nextVideoId, {
              chunks,
              bytesReceived,
              totalBytes,
            });

            setDownloadingMap((prev) => {
              if (!prev[nextVideoId!]) return prev;
              return {
                ...prev,
                [nextVideoId!]: {
                  ...prev[nextVideoId!],
                  status: 'downloading',
                  progress,
                  bytesReceived,
                  totalBytes,
                  speedBytesPerSec: speed,
                  etaSeconds: eta,
                },
              };
            });
          }
        }
      }

      // Finalize complete video file
      const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' });

      // Save into IndexedDB
      await saveDownloadedVideo({
        videoId: nextVideoId,
        courseSlug: params.courseSlug,
        courseTitle: params.courseTitle || 'Course',
        sectionTitle: params.sectionTitle || 'General',
        sectionId: params.sectionId || '',
        unitTitle: unitTitle || 'Video Lesson',
        thumbnailUrl: thumbnailUrl || '',
        durationSeconds: durationSeconds || 0,
        quality: quality || 'Standard',
        sizeBytes: blob.size,
        downloadedAt: Date.now(),
        blob,
        mimeType: 'video/mp4',
      });

      // Cleanup finished item
      partialChunksRef.current.delete(nextVideoId);
      downloadParamsRef.current.delete(nextVideoId);
      queueRef.current = queueRef.current.filter((id) => id !== nextVideoId);
      abortControllersRef.current.delete(nextVideoId);

      const nextMap = { ...downloadingMapRef.current };
      delete nextMap[nextVideoId];
      downloadingMapRef.current = nextMap;

      setDownloadingMap((prev) => {
        const next = { ...prev };
        delete next[nextVideoId!];
        return next;
      });

      // Synchronously mark as downloaded for instant UI update across site
      setDownloadedIds((prev) => new Set([...prev, nextVideoId]));

      // Advance batch progress if present
      setBatchProgress((prev) => {
        if (!prev) return null;
        const nextCompleted = prev.completedItems + 1;
        return {
          ...prev,
          completedItems: nextCompleted,
          isDownloading: nextCompleted < prev.totalItems,
        };
      });

      await refreshDownloads();
    } catch (err: any) {
      if (abortController.signal.aborted) {
        console.log(`Download for video ${nextVideoId} paused or cancelled`);
      } else {
        console.error(`Download failed for video ${nextVideoId}:`, err);
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

        if (isOffline) {
          // YouTube auto-pause on network drop
          setDownloadingMap((prev) => {
            if (!prev[nextVideoId!]) return prev;
            return {
              ...prev,
              [nextVideoId!]: {
                ...prev[nextVideoId!],
                status: 'paused',
                error: 'Waiting for connection...',
              },
            };
          });
        } else {
          setDownloadingMap((prev) => {
            if (!prev[nextVideoId!]) return prev;
            return {
              ...prev,
              [nextVideoId!]: {
                ...prev[nextVideoId!],
                status: 'failed',
                error: err.message || 'Download failed',
              },
            };
          });
        }
      }
    } finally {
      activeVideoIdRef.current = null;
      isWorkerBusyRef.current = false;
      // Immediately pull next item from queue
      setTimeout(() => {
        processQueue();
      }, 50);
    }
  }, [refreshDownloads, resolveVideoAsset]);

  // Public startDownload for a single video
  const startDownload = useCallback(
    async (params: StartDownloadParams) => {
      const { videoId } = params;
      if (!videoId) return;

      // Requirement: Download should not be available for demo, download is premium only option
      if (!checkCanDownload(user)) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('preptea:premium-download-required'));
        }
        return;
      }

      // Check if already downloaded
      if (downloadedIds.has(videoId)) return;

      // Store params
      downloadParamsRef.current.set(videoId, params);

      // Add to queue if not present
      if (!queueRef.current.includes(videoId)) {
        queueRef.current.push(videoId);
      }

      const quality = params.quality || '720p';

      const queuedStatus: DownloadingStatus = {
        status: 'queued',
        progress: 0,
        quality,
        bytesReceived: 0,
        totalBytes: params.expectedSizeBytes || 0,
        unitTitle: params.unitTitle,
        courseSlug: params.courseSlug,
        courseTitle: params.courseTitle,
        sectionTitle: params.sectionTitle,
        sectionId: params.sectionId,
        thumbnailUrl: params.thumbnailUrl,
        durationSeconds: params.durationSeconds,
        assetUrl: params.assetUrl,
      };

      downloadingMapRef.current = {
        ...downloadingMapRef.current,
        [videoId]: queuedStatus,
      };

      setDownloadingMap((prev) => ({
        ...prev,
        [videoId]: queuedStatus,
      }));

      // Trigger queue worker
      setTimeout(() => {
        processQueue();
      }, 10);
    },
    [downloadedIds, processQueue, user]
  );

  // Pause a specific download (YouTube style)
  const pauseDownload = useCallback(
    (videoId: string) => {
      if (activeVideoIdRef.current === videoId) {
        const controller = abortControllersRef.current.get(videoId);
        if (controller) controller.abort();
      }

      downloadingMapRef.current = {
        ...downloadingMapRef.current,
        [videoId]: {
          ...(downloadingMapRef.current[videoId] || {}),
          status: 'paused',
        } as DownloadingStatus,
      };

      setDownloadingMap((prev) => {
        if (!prev[videoId]) return prev;
        return {
          ...prev,
          [videoId]: {
            ...prev[videoId],
            status: 'paused',
          },
        };
      });

      setTimeout(() => {
        processQueue();
      }, 100);
    },
    [processQueue]
  );

  // Resume a paused download (YouTube style with Range header)
  const resumeDownload = useCallback(
    (videoId: string) => {
      // Prioritize resumed item to head of queue
      queueRef.current = [videoId, ...queueRef.current.filter((id) => id !== videoId)];

      downloadingMapRef.current = {
        ...downloadingMapRef.current,
        [videoId]: {
          ...(downloadingMapRef.current[videoId] || {}),
          status: 'queued',
          error: undefined,
        } as DownloadingStatus,
      };

      setDownloadingMap((prev) => {
        if (!prev[videoId]) return prev;
        return {
          ...prev,
          [videoId]: {
            ...prev[videoId],
            status: 'queued',
            error: undefined,
          },
        };
      });

      setTimeout(() => {
        processQueue();
      }, 50);
    },
    [processQueue]
  );

  // Cancel an active or queued download
  const cancelDownload = useCallback(
    (videoId: string) => {
      if (activeVideoIdRef.current === videoId) {
        const controller = abortControllersRef.current.get(videoId);
        if (controller) controller.abort();
      }

      partialChunksRef.current.delete(videoId);
      downloadParamsRef.current.delete(videoId);
      queueRef.current = queueRef.current.filter((id) => id !== videoId);
      abortControllersRef.current.delete(videoId);

      setDownloadingMap((prev) => {
        const next = { ...prev };
        delete next[videoId];
        return next;
      });

      setTimeout(() => {
        processQueue();
      }, 100);
    },
    [processQueue]
  );

  // Pause all downloads
  const pauseAllDownloads = useCallback(() => {
    Object.keys(downloadingMapRef.current).forEach((vId) => {
      pauseDownload(vId);
    });
  }, [pauseDownload]);

  // Resume all downloads
  const resumeAllDownloads = useCallback(() => {
    Object.keys(downloadingMapRef.current).forEach((vId) => {
      resumeDownload(vId);
    });
  }, [resumeDownload]);

  // Auto-pause when offline, auto-resume when online (YouTube algorithm)
  useEffect(() => {
    const handleOffline = () => {
      if (activeVideoIdRef.current) {
        pauseDownload(activeVideoIdRef.current);
      }
    };

    const handleOnline = () => {
      // Find any paused items with 'Waiting for connection...' and resume
      const pausedIds = Object.entries(downloadingMapRef.current)
        .filter(([, s]) => s.status === 'paused')
        .map(([id]) => id);

      if (pausedIds.length > 0) {
        resumeAllDownloads();
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [pauseDownload, resumeAllDownloads]);

  // Status queries
  const isDownloaded = useCallback(
    (videoId: string) => {
      if (!videoId) return false;
      return downloadedIds.has(videoId);
    },
    [downloadedIds]
  );

  const isDownloading = useCallback(
    (videoId: string) => {
      if (!videoId) return false;
      const status = downloadingMap[videoId]?.status;
      return status === 'downloading' || status === 'queued';
    },
    [downloadingMap]
  );

  const isQueued = useCallback(
    (videoId: string) => {
      if (!videoId) return false;
      return downloadingMap[videoId]?.status === 'queued';
    },
    [downloadingMap]
  );

  const isPaused = useCallback(
    (videoId: string) => {
      if (!videoId) return false;
      return downloadingMap[videoId]?.status === 'paused';
    },
    [downloadingMap]
  );

  const isFailed = useCallback(
    (videoId: string) => {
      if (!videoId) return false;
      return downloadingMap[videoId]?.status === 'failed';
    },
    [downloadingMap]
  );

  const retryDownload = useCallback(
    async (videoId: string) => {
      const params = downloadParamsRef.current.get(videoId);
      if (params) {
        await startDownload(params);
        return;
      }
      const item = downloadingMap[videoId];
      if (item && item.courseSlug && item.unitTitle) {
        await startDownload({
          videoId,
          courseSlug: item.courseSlug,
          courseTitle: item.courseTitle || 'Course',
          sectionTitle: item.sectionTitle,
          sectionId: item.sectionId,
          unitTitle: item.unitTitle,
          thumbnailUrl: item.thumbnailUrl,
          durationSeconds: item.durationSeconds || 0,
          quality: item.quality,
        });
      }
    },
    [downloadingMap, startDownload]
  );

  const getDownloadProgress = useCallback(
    (videoId: string) => {
      if (!videoId) return undefined;
      return downloadingMap[videoId]?.progress;
    },
    [downloadingMap]
  );

  const getDownloadStatus = useCallback(
    (videoId: string) => {
      if (!videoId) return undefined;
      return downloadingMap[videoId];
    },
    [downloadingMap]
  );

  // Section queries
  const getSectionDownloadedCount = useCallback(
    (courseSlug: string, sectionTitle: string) => {
      return downloads.filter(
        (d) => d.courseSlug === courseSlug && (d.sectionTitle === sectionTitle || (!d.sectionTitle && sectionTitle === 'General'))
      ).length;
    },
    [downloads]
  );

  const isSectionDownloaded = useCallback(
    (courseSlug: string, sectionTitle: string, totalCount?: number) => {
      if (!courseSlug || !sectionTitle) return false;
      const count = getSectionDownloadedCount(courseSlug, sectionTitle);
      if (totalCount !== undefined && totalCount > 0) {
        return count >= totalCount;
      }
      return count > 0;
    },
    [getSectionDownloadedCount]
  );

  const isSectionDownloading = useCallback(
    (courseSlug: string, sectionTitle: string) => {
      if (
        batchProgress?.isDownloading &&
        batchProgress.courseSlug === courseSlug &&
        batchProgress.sectionTitle === sectionTitle
      ) {
        return true;
      }
      return Object.values(downloadingMap).some(
        (s) => s.courseSlug === courseSlug && s.sectionTitle === sectionTitle && (s.status === 'downloading' || s.status === 'queued')
      );
    },
    [batchProgress, downloadingMap]
  );

  // Course queries
  const getCourseDownloadedCount = useCallback(
    (courseSlug: string) => {
      return downloads.filter((d) => d.courseSlug === courseSlug).length;
    },
    [downloads]
  );

  const isCourseDownloaded = useCallback(
    (courseSlug: string, totalCount?: number) => {
      if (!courseSlug) return false;
      const count = getCourseDownloadedCount(courseSlug);
      if (totalCount !== undefined && totalCount > 0) {
        return count >= totalCount;
      }
      return count > 0;
    },
    [getCourseDownloadedCount]
  );

  const isCourseDownloading = useCallback(
    (courseSlug: string) => {
      if (batchProgress?.isDownloading && batchProgress.courseSlug === courseSlug) {
        return true;
      }
      return Object.values(downloadingMap).some(
        (s) => s.courseSlug === courseSlug && (s.status === 'downloading' || s.status === 'queued')
      );
    },
    [batchProgress, downloadingMap]
  );

  // Batch download an entire section (Queues lessons sequentially)
  const downloadSection = useCallback(
    async ({
      courseSlug,
      courseTitle,
      sectionTitle,
      sectionId,
      preferredQuality,
      units,
    }: {
      courseSlug: string;
      courseTitle: string;
      sectionTitle: string;
      sectionId?: string;
      preferredQuality?: string;
      units: { videoId: string; unitTitle: string; duration?: number }[];
    }) => {
      if (!checkCanDownload(user)) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('preptea:premium-download-required'));
        }
        return;
      }

      const pendingUnits = units.filter(
        (u) => u.videoId && !downloadedIds.has(u.videoId) && !downloadingMap[u.videoId]
      );
      if (pendingUnits.length === 0) return;

      const chosenQuality = preferredQuality || getRememberedQuality('720p');
      const batchId = `sec_${courseSlug}_${sectionTitle}_${Date.now()}`;
      batchCancelRef.current = false;

      setBatchProgress({
        batchId,
        type: 'section',
        title: sectionTitle,
        courseSlug,
        courseTitle,
        sectionTitle,
        totalItems: pendingUnits.length,
        completedItems: 0,
        failedItems: 0,
        isDownloading: true,
        currentVideoTitle: pendingUnits[0].unitTitle,
        quality: chosenQuality,
      });

      for (const u of pendingUnits) {
        if (batchCancelRef.current) break;
        await startDownload({
          videoId: u.videoId,
          courseSlug,
          courseTitle,
          sectionTitle,
          sectionId,
          unitTitle: u.unitTitle,
          thumbnailUrl: '',
          durationSeconds: u.duration || 0,
          quality: chosenQuality,
        });
      }
    },
    [downloadedIds, downloadingMap, startDownload]
  );

  // Batch download an entire course
  const downloadCourse = useCallback(
    async ({
      courseSlug,
      courseTitle,
      preferredQuality,
      sections,
    }: {
      courseSlug: string;
      courseTitle: string;
      preferredQuality?: string;
      sections: {
        sectionTitle: string;
        sectionId?: string;
        units: { videoId: string; unitTitle: string; duration?: number }[];
      }[];
    }) => {
      if (!checkCanDownload(user)) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('preptea:premium-download-required'));
        }
        return;
      }

      const allUnits: {
        videoId: string;
        unitTitle: string;
        sectionTitle: string;
        sectionId?: string;
        duration?: number;
      }[] = [];

      sections.forEach((sec) => {
        sec.units.forEach((u) => {
          if (u.videoId) {
            allUnits.push({
              videoId: u.videoId,
              unitTitle: u.unitTitle,
              sectionTitle: sec.sectionTitle,
              sectionId: sec.sectionId,
              duration: u.duration,
            });
          }
        });
      });

      const pendingUnits = allUnits.filter(
        (u) => !downloadedIds.has(u.videoId) && !downloadingMap[u.videoId]
      );
      if (pendingUnits.length === 0) return;

      const chosenQuality = preferredQuality || getRememberedQuality('720p');
      const batchId = `crs_${courseSlug}_${Date.now()}`;
      batchCancelRef.current = false;

      setBatchProgress({
        batchId,
        type: 'course',
        title: courseTitle,
        courseSlug,
        courseTitle,
        totalItems: pendingUnits.length,
        completedItems: 0,
        failedItems: 0,
        isDownloading: true,
        currentVideoTitle: pendingUnits[0].unitTitle,
        quality: chosenQuality,
      });

      for (const u of pendingUnits) {
        if (batchCancelRef.current) break;
        await startDownload({
          videoId: u.videoId,
          courseSlug,
          courseTitle,
          sectionTitle: u.sectionTitle,
          sectionId: u.sectionId,
          unitTitle: u.unitTitle,
          thumbnailUrl: '',
          durationSeconds: u.duration || 0,
          quality: chosenQuality,
        });
      }
    },
    [downloadedIds, downloadingMap, startDownload]
  );

  const cancelBatchDownload = useCallback(() => {
    batchCancelRef.current = true;
    abortControllersRef.current.forEach((controller) => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    });
    abortControllersRef.current.clear();
    partialChunksRef.current.clear();
    downloadParamsRef.current.clear();
    queueRef.current = [];
    activeVideoIdRef.current = null;
    setDownloadingMap({});
    setBatchProgress(null);
  }, []);

  const deleteDownload = useCallback(
    async (videoId: string) => {
      try {
        const existingUrl = activeBlobUrlsRef.current.get(videoId);
        if (existingUrl) {
          try {
            URL.revokeObjectURL(existingUrl);
          } catch {
            // ignore
          }
          activeBlobUrlsRef.current.delete(videoId);
        }

        await deleteDownloadedVideo(videoId);
        setDownloadedIds((prev) => {
          const next = new Set(prev);
          next.delete(videoId);
          return next;
        });
        await refreshDownloads();
      } catch (err) {
        console.error('Failed to delete download:', err);
      }
    },
    [refreshDownloads]
  );

  const deleteSectionDownloads = useCallback(
    async (courseSlug: string, sectionTitle: string) => {
      try {
        const sectionVideos = downloads.filter(
          (d) => d.courseSlug === courseSlug && d.sectionTitle === sectionTitle
        );
        sectionVideos.forEach((v) => {
          const url = activeBlobUrlsRef.current.get(v.videoId);
          if (url) {
            try {
              URL.revokeObjectURL(url);
            } catch {
              // ignore
            }
            activeBlobUrlsRef.current.delete(v.videoId);
          }
        });

        await deleteSectionDownloadedVideos(courseSlug, sectionTitle);
        await refreshDownloads();
      } catch (err) {
        console.error('Failed to delete section downloads:', err);
      }
    },
    [downloads, refreshDownloads]
  );

  const deleteCourseDownloads = useCallback(
    async (courseSlug: string) => {
      try {
        const courseVideos = downloads.filter((d) => d.courseSlug === courseSlug);
        courseVideos.forEach((v) => {
          const url = activeBlobUrlsRef.current.get(v.videoId);
          if (url) {
            try {
              URL.revokeObjectURL(url);
            } catch {
              // ignore
            }
            activeBlobUrlsRef.current.delete(v.videoId);
          }
        });

        await deleteCourseDownloadedVideos(courseSlug);
        await refreshDownloads();
      } catch (err) {
        console.error('Failed to delete course downloads:', err);
      }
    },
    [downloads, refreshDownloads]
  );

  const clearAllDownloads = useCallback(async () => {
    try {
      activeBlobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
      activeBlobUrlsRef.current.clear();

      await clearAllDownloadedVideos();
      await refreshDownloads();
    } catch (err) {
      console.error('Failed to clear all downloads:', err);
    }
  }, [refreshDownloads]);

  const getBlobUrl = useCallback(async (videoId: string): Promise<string | null> => {
    if (!videoId) return null;

    if (activeBlobUrlsRef.current.has(videoId)) {
      return activeBlobUrlsRef.current.get(videoId)!;
    }

    try {
      const blob = await getDownloadedVideoBlob(videoId);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      activeBlobUrlsRef.current.set(videoId, url);
      return url;
    } catch (err) {
      console.error('Failed to get video blob URL:', err);
      return null;
    }
  }, []);

  const revokeBlobUrl = useCallback((url: string) => {
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
      for (const [vId, activeUrl] of activeBlobUrlsRef.current.entries()) {
        if (activeUrl === url) {
          activeBlobUrlsRef.current.delete(vId);
          break;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <DownloadContext.Provider
      value={{
        downloads,
        downloadedIds,
        downloadingMap,
        storageUsage,
        batchProgress,
        isDownloaded,
        isDownloading,
        isQueued,
        isPaused,
        isFailed,
        retryDownload,
        getDownloadProgress,
        getDownloadStatus,
        isSectionDownloaded,
        isSectionDownloading,
        getSectionDownloadedCount,
        isCourseDownloaded,
        isCourseDownloading,
        getCourseDownloadedCount,
        startDownload,
        pauseDownload,
        resumeDownload,
        cancelDownload,
        pauseAllDownloads,
        resumeAllDownloads,
        downloadSection,
        downloadCourse,
        cancelBatchDownload,
        deleteDownload,
        deleteSectionDownloads,
        deleteCourseDownloads,
        clearAllDownloads,
        getBlobUrl,
        revokeBlobUrl,
        refreshDownloads,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownloads() {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownloads must be used within a DownloadProvider');
  }
  return context;
}
