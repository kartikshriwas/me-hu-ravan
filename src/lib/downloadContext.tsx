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
  getCachedBatchAccess,
  verifyAndGetCachedBatchAccess,
  saveCachedBatchAccess,
} from '@/lib/batchAccess';

export interface StartDownloadParams {
  videoId: string;
  courseSlug: string;
  courseTitle: string;
  sectionTitle?: string;
  sectionId?: string;
  unitTitle: string;
  thumbnailUrl: string;
  durationSeconds: number;
  quality?: string;
  assetUrl?: string;
  expectedSizeBytes?: number;
}

export interface DownloadingStatus {
  progress: number;
  quality: string;
  bytesReceived: number;
  totalBytes: number;
  unitTitle?: string;
  courseSlug?: string;
  courseTitle?: string;
  sectionTitle?: string;
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
  getDownloadProgress: (videoId: string) => number | undefined;
  isSectionDownloaded: (courseSlug: string, sectionTitle: string, totalCount?: number) => boolean;
  isSectionDownloading: (courseSlug: string, sectionTitle: string) => boolean;
  getSectionDownloadedCount: (courseSlug: string, sectionTitle: string) => number;
  isCourseDownloaded: (courseSlug: string, totalCount?: number) => boolean;
  isCourseDownloading: (courseSlug: string) => boolean;
  getCourseDownloadedCount: (courseSlug: string) => number;

  // Actions
  startDownload: (params: StartDownloadParams) => Promise<void>;
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
  cancelDownload: (videoId: string) => void;
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

  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const activeBlobUrlsRef = useRef<Map<string, string>>(new Map());
  const batchCancelRef = useRef<boolean>(false);

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
      if (!isOnline) return; // Keep cached access state intact when offline

      const cached = await verifyAndGetCachedBatchAccess();

      if (user && user.email) {
        const liveAccess = checkUserCourseAccess(user);

        // Security Check: If user previously had access, but now liveAccess is revoked:
        if (cached && cached.email === user.email.toLowerCase().trim() && cached.hasAccess && !liveAccess) {
          console.warn('PrepTea Security: Course batch access revoked. Deleting all offline downloaded lessons...');
          await clearAllDownloadedVideos();
          setDownloads([]);
          setDownloadedIds(new Set());
          setStorageUsage({ usedBytes: 0, count: 0 });
          saveCachedBatchAccess(user.email, false, []);
          return;
        }

        // Keep cache updated with current access
        if (liveAccess) {
          saveCachedBatchAccess(user.email, true, user.allowedBatches || [], '');
        } else {
          saveCachedBatchAccess(user.email, false, [], '');
        }
      }
    };

    verifyAndSyncAccess();

    // Whenever user comes back online, immediately re-verify permissions
    const handleOnline = () => {
      verifyAndSyncAccess();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
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
      return !!downloadingMap[videoId];
    },
    [downloadingMap]
  );

  const getDownloadProgress = useCallback(
    (videoId: string) => {
      if (!videoId) return undefined;
      return downloadingMap[videoId]?.progress;
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
        (s) => s.courseSlug === courseSlug && s.sectionTitle === sectionTitle
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
      return Object.values(downloadingMap).some((s) => s.courseSlug === courseSlug);
    },
    [batchProgress, downloadingMap]
  );

  const cancelDownload = useCallback((videoId: string) => {
    const controller = abortControllersRef.current.get(videoId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(videoId);
    }
    setDownloadingMap((prev) => {
      const next = { ...prev };
      delete next[videoId];
      return next;
    });
  }, []);

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
        // Revoke any active blob urls for videos in this section
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

  // Internal helper to download a single video stream
  const executeDownload = useCallback(
    async ({
      videoId,
      courseSlug,
      courseTitle,
      sectionTitle,
      sectionId,
      unitTitle,
      thumbnailUrl,
      durationSeconds,
      quality,
      assetUrl,
      expectedSizeBytes,
      signal,
    }: StartDownloadParams & { signal: AbortSignal }) => {
      // Attempt direct fetch first (Wistia supports CORS with Origin header)
      let response: Response | null = null;
      try {
        response = await fetch(assetUrl!, {
          signal,
        });
      } catch (fetchErr: any) {
        if (signal.aborted) throw fetchErr;
        console.warn('Direct fetch failed, falling back to server stream proxy:', fetchErr);
      }

      // If direct fetch fails or is not ok, use our same-origin stream proxy
      if (!response || !response.ok) {
        const proxyUrl = `/api/video/download-stream?url=${encodeURIComponent(assetUrl!)}`;
        response = await fetch(proxyUrl, {
          signal,
        });
      }

      if (!response.ok || !response.body) {
        throw new Error(`Failed to download stream: HTTP ${response.status}`);
      }

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader
        ? parseInt(contentLengthHeader, 10)
        : expectedSizeBytes || 0;

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytesReceived = 0;
      let lastReportTime = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          bytesReceived += value.length;

          const now = Date.now();
          if (now - lastReportTime > 120 || bytesReceived === totalBytes) {
            lastReportTime = now;
            const progress = totalBytes > 0 ? Math.min(99, Math.round((bytesReceived / totalBytes) * 100)) : 50;

            setDownloadingMap((prev) => {
              if (!prev[videoId]) return prev;
              return {
                ...prev,
                [videoId]: {
                  ...prev[videoId],
                  progress,
                  bytesReceived,
                  totalBytes,
                },
              };
            });
          }
        }
      }

      // Assemble binary blob
      const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' });

      // Save into IndexedDB
      await saveDownloadedVideo({
        videoId,
        courseSlug,
        courseTitle: courseTitle || 'Course',
        sectionTitle: sectionTitle || 'General',
        sectionId: sectionId || '',
        unitTitle: unitTitle || 'Video Lesson',
        thumbnailUrl: thumbnailUrl || '',
        durationSeconds: durationSeconds || 0,
        quality: quality || 'Standard',
        sizeBytes: blob.size,
        downloadedAt: Date.now(),
        blob,
        mimeType: 'video/mp4',
      });
    },
    []
  );

  // Helper to fetch video metadata if assetUrl is missing, respecting preferred quality
  const resolveVideoAsset = useCallback(async (videoId: string, preferredQuality?: string) => {
    try {
      const res = await fetch(`/api/video/${videoId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json?.success || !json.video) throw new Error('Video data not found');
      const { video } = json;
      const assets = video.assets || [];

      let chosen: any = null;
      if (preferredQuality) {
        const heightMatch = parseInt(preferredQuality.replace(/\D/g, ''), 10);
        if (heightMatch) {
          chosen = assets.find((a: any) => a.height === heightMatch);
          if (!chosen) {
            // Find closest available asset by height difference
            const sortedByDiff = [...assets].sort((a: any, b: any) => 
              Math.abs((a.height || 0) - heightMatch) - Math.abs((b.height || 0) - heightMatch)
            );
            chosen = sortedByDiff[0];
          }
        }
      }

      if (!chosen) {
        chosen =
          assets.find((a: any) => a.height === 720) ||
          assets.find((a: any) => a.height === 1080) ||
          assets.find((a: any) => a.height <= 720 && a.height >= 480) ||
          assets[0];
      }

      if (!chosen?.url) throw new Error('No downloadable MP4 asset found');

      const qualityLabel = chosen.displayName || (chosen.height ? `${chosen.height}p` : (preferredQuality || '720p'));

      return {
        assetUrl: chosen.url as string,
        quality: qualityLabel,
        expectedSizeBytes: chosen.sizeBytes,
        thumbnailUrl: video.thumbnailUrl || '',
        durationSeconds: video.durationSeconds || 0,
        unitTitle: video.name || '',
      };
    } catch (err: any) {
      console.error(`Failed to resolve asset for video ${videoId}:`, err);
      return null;
    }
  }, []);

  // Public startDownload for a single video
  const startDownload = useCallback(
    async (params: StartDownloadParams) => {
      const { videoId } = params;
      if (!videoId) return;

      const abortController = new AbortController();
      abortControllersRef.current.set(videoId, abortController);

      setDownloadingMap((prev) => ({
        ...prev,
        [videoId]: {
          progress: 0,
          quality: params.quality || '720p',
          bytesReceived: 0,
          totalBytes: params.expectedSizeBytes || 0,
          unitTitle: params.unitTitle,
          courseSlug: params.courseSlug,
          courseTitle: params.courseTitle,
          sectionTitle: params.sectionTitle,
        },
      }));

      try {
        let assetUrl = params.assetUrl;
        let quality = params.quality || '720p';
        let expectedSizeBytes = params.expectedSizeBytes;
        let thumbnailUrl = params.thumbnailUrl;
        let durationSeconds = params.durationSeconds;
        let unitTitle = params.unitTitle;

        if (!assetUrl) {
          const resolved = await resolveVideoAsset(videoId, quality);
          if (!resolved) throw new Error('Could not find video stream');
          assetUrl = resolved.assetUrl;
          quality = resolved.quality;
          expectedSizeBytes = resolved.expectedSizeBytes;
          if (!thumbnailUrl) thumbnailUrl = resolved.thumbnailUrl;
          if (!durationSeconds) durationSeconds = resolved.durationSeconds;
          if (!unitTitle) unitTitle = resolved.unitTitle;
        }

        await executeDownload({
          ...params,
          assetUrl,
          quality,
          expectedSizeBytes,
          thumbnailUrl,
          durationSeconds,
          unitTitle,
          signal: abortController.signal,
        });

        setDownloadingMap((prev) => {
          const next = { ...prev };
          delete next[videoId];
          return next;
        });
        abortControllersRef.current.delete(videoId);
        await refreshDownloads();
      } catch (err: any) {
        if (abortController.signal.aborted) {
          console.log(`Download for video ${videoId} was cancelled.`);
        } else {
          console.error(`Download error for video ${videoId}:`, err);
          alert(`Download failed: ${err.message || 'Unknown network error'}`);
        }

        setDownloadingMap((prev) => {
          const next = { ...prev };
          delete next[videoId];
          return next;
        });
        abortControllersRef.current.delete(videoId);
      }
    },
    [executeDownload, refreshDownloads, resolveVideoAsset]
  );

  // Batch download an entire section
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
      const pendingUnits = units.filter(
        (u) => u.videoId && !downloadedIds.has(u.videoId) && !downloadingMap[u.videoId]
      );
      if (pendingUnits.length === 0) return;

      const chosenQuality = preferredQuality || '720p';
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

      for (let i = 0; i < pendingUnits.length; i++) {
        if (batchCancelRef.current) break;
        const u = pendingUnits[i];

        setBatchProgress((prev) =>
          prev ? { ...prev, currentVideoTitle: u.unitTitle, quality: chosenQuality } : null
        );

        try {
          const resolved = await resolveVideoAsset(u.videoId, chosenQuality);
          if (!resolved) throw new Error('Video stream unavailable');

          const abortController = new AbortController();
          abortControllersRef.current.set(u.videoId, abortController);

          setDownloadingMap((prev) => ({
            ...prev,
            [u.videoId]: {
              progress: 0,
              quality: resolved.quality || chosenQuality,
              bytesReceived: 0,
              totalBytes: resolved.expectedSizeBytes || 0,
              unitTitle: u.unitTitle,
              courseSlug,
              courseTitle,
              sectionTitle,
            },
          }));

          await executeDownload({
            videoId: u.videoId,
            courseSlug,
            courseTitle,
            sectionTitle,
            sectionId,
            unitTitle: u.unitTitle,
            thumbnailUrl: resolved.thumbnailUrl,
            durationSeconds: u.duration || resolved.durationSeconds,
            quality: resolved.quality || chosenQuality,
            assetUrl: resolved.assetUrl,
            expectedSizeBytes: resolved.expectedSizeBytes,
            signal: abortController.signal,
          });

          setDownloadingMap((prev) => {
            const next = { ...prev };
            delete next[u.videoId];
            return next;
          });
          abortControllersRef.current.delete(u.videoId);
          await refreshDownloads();

          setBatchProgress((prev) =>
            prev ? { ...prev, completedItems: prev.completedItems + 1 } : null
          );
        } catch (err: any) {
          console.warn(`Section download item failed (${u.unitTitle}):`, err);
          setDownloadingMap((prev) => {
            const next = { ...prev };
            delete next[u.videoId];
            return next;
          });
          abortControllersRef.current.delete(u.videoId);
          setBatchProgress((prev) =>
            prev ? { ...prev, failedItems: prev.failedItems + 1 } : null
          );
        }
      }

      setBatchProgress((prev) => (prev ? { ...prev, isDownloading: false } : null));
      setTimeout(() => {
        setBatchProgress(null);
      }, 3000);
    },
    [downloadedIds, downloadingMap, executeDownload, refreshDownloads, resolveVideoAsset]
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

      const chosenQuality = preferredQuality || '720p';
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

      for (let i = 0; i < pendingUnits.length; i++) {
        if (batchCancelRef.current) break;
        const u = pendingUnits[i];

        setBatchProgress((prev) =>
          prev
            ? {
                ...prev,
                currentVideoTitle: u.unitTitle,
                sectionTitle: u.sectionTitle,
                quality: chosenQuality,
              }
            : null
        );

        try {
          const resolved = await resolveVideoAsset(u.videoId, chosenQuality);
          if (!resolved) throw new Error('Video stream unavailable');

          const abortController = new AbortController();
          abortControllersRef.current.set(u.videoId, abortController);

          setDownloadingMap((prev) => ({
            ...prev,
            [u.videoId]: {
              progress: 0,
              quality: resolved.quality || chosenQuality,
              bytesReceived: 0,
              totalBytes: resolved.expectedSizeBytes || 0,
              unitTitle: u.unitTitle,
              courseSlug,
              courseTitle,
              sectionTitle: u.sectionTitle,
            },
          }));

          await executeDownload({
            videoId: u.videoId,
            courseSlug,
            courseTitle,
            sectionTitle: u.sectionTitle,
            sectionId: u.sectionId,
            unitTitle: u.unitTitle,
            thumbnailUrl: resolved.thumbnailUrl,
            durationSeconds: u.duration || resolved.durationSeconds,
            quality: resolved.quality || chosenQuality,
            assetUrl: resolved.assetUrl,
            expectedSizeBytes: resolved.expectedSizeBytes,
            signal: abortController.signal,
          });

          setDownloadingMap((prev) => {
            const next = { ...prev };
            delete next[u.videoId];
            return next;
          });
          abortControllersRef.current.delete(u.videoId);
          await refreshDownloads();

          setBatchProgress((prev) =>
            prev ? { ...prev, completedItems: prev.completedItems + 1 } : null
          );
        } catch (err: any) {
          console.warn(`Course download item failed (${u.unitTitle}):`, err);
          setDownloadingMap((prev) => {
            const next = { ...prev };
            delete next[u.videoId];
            return next;
          });
          abortControllersRef.current.delete(u.videoId);
          setBatchProgress((prev) =>
            prev ? { ...prev, failedItems: prev.failedItems + 1 } : null
          );
        }
      }

      setBatchProgress((prev) => (prev ? { ...prev, isDownloading: false } : null));
      setTimeout(() => {
        setBatchProgress(null);
      }, 3000);
    },
    [downloadedIds, downloadingMap, executeDownload, refreshDownloads, resolveVideoAsset]
  );

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
        getDownloadProgress,
        isSectionDownloaded,
        isSectionDownloading,
        getSectionDownloadedCount,
        isCourseDownloaded,
        isCourseDownloading,
        getCourseDownloadedCount,
        startDownload,
        downloadSection,
        downloadCourse,
        cancelDownload,
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
