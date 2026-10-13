'use client';

export interface ServerStreakState {
  currentStreak: number;
  longestStreak: number;
  studiedToday: boolean;
  activeDaysThisWeek: boolean[];
  lastStudiedDate: string;
  totalActiveDays: number;
  studyDays: string[];
}

export interface CourseResumeState {
  courseSlug: string;
  lastVideoId: string;
  lastVideoTitle: string;
  lastPlaybackTime: number;
  lastDuration: number;
  updatedAt: string;
}

export interface VideoPlaybackState {
  time: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
}

export interface UserProgressData {
  completedVideos: string[];
  totalVideosCompleted: number;
  streak: ServerStreakState;
  coursesProgress: Record<string, CourseResumeState>;
  videoPlayback: Record<string, VideoPlaybackState>;
  totalWatchTimeSeconds: number;
}

const LOCAL_COMPLETED_KEY = 'preptea_completed_videos';
const LOCAL_STREAK_KEY = 'preptea_learning_streak_data';
const SYNC_EVENT_NAME = 'preptea_study_update';

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let inflightFetchProgressPromise: Promise<UserProgressData | null> | null = null;
let lastProgressFetchTime = 0;
let cachedProgressData: UserProgressData | null = null;
const CACHE_TTL_MS = 60000; // 60 seconds (prevents rapid DB re-fetching on routine page navigations)

/**
 * Fetch fresh learning telemetry from MongoDB via /api/user/progress
 * Deduplicated and cached to prevent network cascades
 */
export async function fetchUserProgressFromDb(forceFresh = false): Promise<UserProgressData | null> {
  const now = Date.now();
  const effectiveTtl = forceFresh ? 3000 : CACHE_TTL_MS;
  if (cachedProgressData && now - lastProgressFetchTime < effectiveTtl) {
    return cachedProgressData;
  }

  if (inflightFetchProgressPromise) {
    return inflightFetchProgressPromise;
  }

  inflightFetchProgressPromise = (async () => {
    try {
      const todayStr = getLocalDateString();
      const res = await fetch(`/api/user/progress?clientDate=${todayStr}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });

      if (res.status === 401) {
        // User is not logged in; fallback to localStorage
        return null;
      }

      if (!res.ok) {
        console.warn('Could not fetch learning progress from DB:', res.statusText);
        return null;
      }

      const data = await res.json();
      if (data.success) {
        cachedProgressData = data;
        lastProgressFetchTime = Date.now();
        applyServerProgressToLocalStorage(data);
        return data;
      }
    } catch (err) {
      console.warn('Network error fetching progress from DB:', err);
    } finally {
      inflightFetchProgressPromise = null;
    }
    return null;
  })();

  return inflightFetchProgressPromise;
}

/**
 * Reconciles server progress with client localStorage using Set union and Last-Write-Wins.
 * Updates all course resume points, video playback timestamps, and completed units.
 * Returns true if local state changed and dispatches preptea_study_update event.
 */
export function applyServerProgressToLocalStorage(data: UserProgressData): boolean {
  if (typeof window === 'undefined' || !data) return false;
  let changed = false;

  try {
    // 1. Merge completed videos via Set union so progress made on other devices is never lost
    if (Array.isArray(data.completedVideos)) {
      const prevRaw = localStorage.getItem(LOCAL_COMPLETED_KEY);
      const prevList: string[] = prevRaw ? JSON.parse(prevRaw) : [];
      const mergedSet = new Set([...prevList, ...data.completedVideos]);
      const mergedList = Array.from(mergedSet);
      if (mergedList.length !== prevList.length || !prevList.every((v) => mergedSet.has(v))) {
        localStorage.setItem(LOCAL_COMPLETED_KEY, JSON.stringify(mergedList));
        changed = true;
      }
    }

    // 2. Merge study streak days via Set union
    if (data.streak?.studyDays && Array.isArray(data.streak.studyDays)) {
      const prevRaw = localStorage.getItem(LOCAL_STREAK_KEY);
      let prevDays: string[] = [];
      if (prevRaw) {
        try {
          const parsed = JSON.parse(prevRaw);
          if (Array.isArray(parsed.studyDays)) prevDays = parsed.studyDays;
        } catch (e) {}
      }
      const mergedSet = new Set([...prevDays, ...data.streak.studyDays]);
      const mergedDays = Array.from(mergedSet).sort();
      if (mergedDays.length !== prevDays.length || !prevDays.every((d) => mergedSet.has(d))) {
        localStorage.setItem(
          LOCAL_STREAK_KEY,
          JSON.stringify({
            studyDays: mergedDays,
            lastUpdated: Date.now(),
          })
        );
        changed = true;
      }
    }

    // 3. Reconcile course resume states with Last-Write-Wins (LWW)
    if (data.coursesProgress && typeof data.coursesProgress === 'object') {
      Object.entries(data.coursesProgress).forEach(([slug, val]: [string, any]) => {
        if (val?.lastVideoId) {
          const key = `preptea_last_video_${slug}`;
          const localRaw = localStorage.getItem(key);
          let shouldUseServer = true;
          if (localRaw) {
            try {
              const localParsed = JSON.parse(localRaw);
              const serverTime = val.updatedAt ? new Date(val.updatedAt).getTime() : 0;
              const localTime = localParsed.updatedAt ? new Date(localParsed.updatedAt).getTime() : 0;
              if (localTime > serverTime) {
                shouldUseServer = false;
              }
            } catch (e) {}
          }
          if (shouldUseServer) {
            let isIdentical = false;
            if (localRaw) {
              try {
                const localParsed = JSON.parse(localRaw);
                if (
                  localParsed.videoId === val.lastVideoId &&
                  Math.abs((localParsed.timestamp || 0) - (val.lastPlaybackTime || 0)) < 1
                ) {
                  isIdentical = true;
                }
              } catch (e) {}
            }
            if (!isIdentical) {
              const nextPayload = JSON.stringify({
                videoId: val.lastVideoId,
                title: val.lastVideoTitle || 'Lesson',
                timestamp: val.lastPlaybackTime || 0,
                updatedAt: val.updatedAt ? new Date(val.updatedAt).getTime() : Date.now(),
              });
              localStorage.setItem(key, nextPayload);
              changed = true;
            }
          }
        }
      });
    }

    // 4. Reconcile video playback positions (LWW / highest playback progress)
    if (data.videoPlayback && typeof data.videoPlayback === 'object') {
      const prevPbRaw = localStorage.getItem('preptea_video_playback_map');
      const prevPbMap: Record<string, VideoPlaybackState> = prevPbRaw ? JSON.parse(prevPbRaw) : {};
      let pbChanged = false;

      Object.entries(data.videoPlayback).forEach(([vId, val]: [string, any]) => {
        const localPb = prevPbMap[vId];
        const serverTime = typeof val.time === 'number' ? val.time : 0;
        const localTime = localPb?.time || 0;
        const serverUpdatedAt = val.updatedAt ? new Date(val.updatedAt).getTime() : 0;
        const localUpdatedAt = localPb?.updatedAt ? new Date(localPb.updatedAt).getTime() : 0;

        const isDifferent =
          !localPb ||
          Math.abs(localTime - serverTime) > 1 ||
          Boolean(localPb.completed) !== Boolean(val.completed);

        if (isDifferent && (serverUpdatedAt >= localUpdatedAt || serverTime > localTime)) {
          prevPbMap[vId] = {
            time: serverTime,
            duration: val.duration || 0,
            completed: val.completed || false,
            updatedAt: val.updatedAt || new Date().toISOString(),
          };
          if (serverTime > 0) {
            const localSaved = localStorage.getItem(`preptea_video_time_${vId}`);
            if (localSaved !== String(serverTime)) {
              localStorage.setItem(`preptea_video_time_${vId}`, String(serverTime));
              changed = true;
            }
          }
          pbChanged = true;
          changed = true;
        }
      });

      if (pbChanged) {
        localStorage.setItem('preptea_video_playback_map', JSON.stringify(prevPbMap));
      }
    }

    if (changed) {
      window.dispatchEvent(new Event(SYNC_EVENT_NAME));
    }
  } catch (e) {
    console.warn('Error applying server progress to localStorage:', e);
  }

  return changed;
}

/**
 * Record a video as completed in MongoDB and update user's daily study streak
 */
export async function recordVideoCompletionToDb(
  videoId: string,
  courseSlug?: string,
  duration?: number
): Promise<void> {
  if (!videoId) return;

  const todayStr = getLocalDateString();

  // 1. Optimistic instant local update
  if (typeof window !== 'undefined') {
    try {
      const rawCompleted = localStorage.getItem(LOCAL_COMPLETED_KEY);
      const list: string[] = rawCompleted ? JSON.parse(rawCompleted) : [];
      if (!list.includes(videoId)) {
        list.push(videoId);
        localStorage.setItem(LOCAL_COMPLETED_KEY, JSON.stringify(list));
      }

      const rawStreak = localStorage.getItem(LOCAL_STREAK_KEY);
      let studyDays: string[] = [];
      if (rawStreak) {
        try {
          const parsed = JSON.parse(rawStreak);
          if (Array.isArray(parsed.studyDays)) studyDays = parsed.studyDays;
        } catch (e) {}
      }
      if (!studyDays.includes(todayStr)) {
        studyDays.push(todayStr);
        localStorage.setItem(
          LOCAL_STREAK_KEY,
          JSON.stringify({ studyDays, lastUpdated: Date.now() })
        );
      }

      window.dispatchEvent(new Event(SYNC_EVENT_NAME));
    } catch (e) {
      // ignore
    }
  }

  // 2. Persist to MongoDB
  try {
    await fetch('/api/user/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        action: 'video_complete',
        videoId,
        courseSlug,
        duration: duration || 0,
        clientDate: todayStr,
      }),
    });
  } catch (err) {
    console.warn('Failed to sync video completion to DB:', err);
  }
}

/**
 * Throttle-friendly playback heartbeat to save resume point and watch time to MongoDB
 */
export async function recordPlaybackProgressToDb(
  videoId: string,
  courseSlug?: string,
  time: number = 0,
  duration: number = 0,
  title?: string,
  deltaSeconds: number = 0
): Promise<void> {
  if (!videoId) return;

  // Optimistic local update
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`preptea_video_time_${videoId}`, String(time));
      const raw = localStorage.getItem('preptea_video_playback_map');
      const map: Record<string, VideoPlaybackState> = raw ? JSON.parse(raw) : {};
      map[videoId] = {
        time,
        duration,
        completed: duration > 0 ? time / duration >= 0.88 : false,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('preptea_video_playback_map', JSON.stringify(map));
    } catch (e) {
      // ignore
    }
  }

  try {
    await fetch('/api/user/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        action: 'playback_progress',
        videoId,
        courseSlug,
        time,
        duration,
        title,
        deltaSeconds,
      }),
    });
  } catch (err) {
    // Non-blocking telemetry
  }
}

/**
 * Resolves the resume timestamp for a video, checking local storage first,
 * falling back to DB if needed. If server has a newer timestamp or further progress,
 * prioritizes server to enable seamless multi-device resume.
 */
export async function getResumeTimestamp(
  videoId: string,
  courseSlug?: string
): Promise<number | null> {
  if (typeof window === 'undefined' || !videoId) return null;

  let localTime: number | null = null;
  let localUpdatedAt = 0;
  try {
    const local = localStorage.getItem(`preptea_video_time_${videoId}`);
    if (local) {
      const parsed = parseFloat(local);
      if (!isNaN(parsed) && parsed > 5) localTime = parsed;
    }
    const playbackMapRaw = localStorage.getItem('preptea_video_playback_map');
    if (playbackMapRaw) {
      const pbMap = JSON.parse(playbackMapRaw);
      if (pbMap[videoId]?.updatedAt) {
        localUpdatedAt = new Date(pbMap[videoId].updatedAt).getTime();
      }
    }
  } catch (e) {}

  // Fetch cloud progress (fresh to prioritize other devices)
  try {
    const data = await fetchUserProgressFromDb(true);
    const serverVideo = data?.videoPlayback?.[videoId];
    const serverTime = serverVideo?.time && serverVideo.time > 5 ? serverVideo.time : null;
    const serverUpdatedAt = serverVideo?.updatedAt ? new Date(serverVideo.updatedAt).getTime() : 0;

    let serverCourseTime: number | null = null;
    let serverCourseUpdatedAt = 0;
    if (courseSlug && data?.coursesProgress?.[courseSlug]?.lastVideoId === videoId) {
      const cp = data.coursesProgress[courseSlug];
      if (cp.lastPlaybackTime > 5) {
        serverCourseTime = cp.lastPlaybackTime;
        serverCourseUpdatedAt = cp.updatedAt ? new Date(cp.updatedAt).getTime() : 0;
      }
    }

    const effectiveServerTime = serverTime || serverCourseTime;
    const effectiveServerUpdatedAt = Math.max(serverUpdatedAt, serverCourseUpdatedAt);

    // If server has a newer timestamp or higher progress, prioritize server!
    if (effectiveServerTime !== null) {
      if (localTime === null || effectiveServerUpdatedAt >= localUpdatedAt || effectiveServerTime > localTime) {
        try {
          localStorage.setItem(`preptea_video_time_${videoId}`, String(effectiveServerTime));
        } catch (e) {}
        return effectiveServerTime;
      }
    }
  } catch (e) {}

  return localTime;
}

/**
 * Helper to get all recorded video playback states from localStorage
 */
export function getVideoPlaybackMap(): Record<string, VideoPlaybackState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('preptea_video_playback_map');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

let lastSyncedSnapshot = '';
let lastSyncTimestamp = 0;
let inflightSyncPromise: Promise<void> | null = null;

/**
 * Auto-merge local offline data into MongoDB upon user session initialization
 */
export async function syncLocalProgressToDb(force = false): Promise<void> {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  // Don't spam DB within 4 seconds even if forced
  if (now - lastSyncTimestamp < 4000) {
    return;
  }

  if (inflightSyncPromise) {
    return inflightSyncPromise;
  }

  inflightSyncPromise = (async () => {
    try {
      let completedVideos: string[] = [];
      let studyDays: string[] = [];

      const rawCompleted = localStorage.getItem(LOCAL_COMPLETED_KEY);
      if (rawCompleted) {
        try {
          const parsed = JSON.parse(rawCompleted);
          if (Array.isArray(parsed)) completedVideos = parsed;
        } catch (e) {}
      }

      const rawStreak = localStorage.getItem(LOCAL_STREAK_KEY);
      if (rawStreak) {
        try {
          const parsed = JSON.parse(rawStreak);
          if (Array.isArray(parsed.studyDays)) studyDays = parsed.studyDays;
        } catch (e) {}
      }

      // Gather local course resume points
      const coursesProgress: Record<string, any> = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('preptea_last_video_')) {
            const slug = key.replace('preptea_last_video_', '');
            const val = localStorage.getItem(key);
            if (val) {
              const parsed = JSON.parse(val);
              if (parsed.videoId) {
                coursesProgress[slug] = {
                  lastVideoId: parsed.videoId,
                  lastVideoTitle: parsed.title,
                  lastPlaybackTime: parsed.timestamp || 0,
                  updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt).toISOString() : new Date().toISOString(),
                };
              }
            }
          }
        }
      } catch (e) {}

      // Gather local video playback points
      let videoPlayback: Record<string, any> = {};
      try {
        const rawPb = localStorage.getItem('preptea_video_playback_map');
        if (rawPb) videoPlayback = JSON.parse(rawPb);
      } catch (e) {}

      const currentSnapshot = `${completedVideos.join(',')}|${studyDays.join(',')}|${Object.keys(coursesProgress).length}`;
      if (!force && currentSnapshot === lastSyncedSnapshot && Date.now() - lastSyncTimestamp < 30000) {
        return;
      }

      const res = await fetch('/api/user/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_local',
          completedVideos,
          studyDays,
          coursesProgress,
          videoPlayback,
          clientDate: getLocalDateString(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          lastSyncedSnapshot = currentSnapshot;
          lastSyncTimestamp = Date.now();
          cachedProgressData = data;
          lastProgressFetchTime = Date.now();
          applyServerProgressToLocalStorage(data);
        }
      }
    } catch (e) {
      console.warn('Syncing local progress to DB failed:', e);
    } finally {
      inflightSyncPromise = null;
    }
  })();

  return inflightSyncPromise;
}
