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
  if (!forceFresh && cachedProgressData && now - lastProgressFetchTime < CACHE_TTL_MS) {
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

        // Sync DB state to localStorage as instant offline cache
        if (typeof window !== 'undefined') {
          try {
            let changed = false;
            if (Array.isArray(data.completedVideos)) {
              const prev = localStorage.getItem(LOCAL_COMPLETED_KEY);
              const serialized = JSON.stringify(data.completedVideos);
              if (prev !== serialized) {
                localStorage.setItem(LOCAL_COMPLETED_KEY, serialized);
                changed = true;
              }
            }
            if (data.streak?.studyDays) {
              const prev = localStorage.getItem(LOCAL_STREAK_KEY);
              const serialized = JSON.stringify({
                studyDays: data.streak.studyDays,
                lastUpdated: Date.now(),
              });
              if (prev !== serialized) {
                localStorage.setItem(LOCAL_STREAK_KEY, serialized);
                changed = true;
              }
            }
            if (data.coursesProgress) {
              Object.entries(data.coursesProgress).forEach(([slug, val]: [string, any]) => {
                if (val?.lastVideoId) {
                  localStorage.setItem(
                    `preptea_last_video_${slug}`,
                    JSON.stringify({
                      videoId: val.lastVideoId,
                      title: val.lastVideoTitle,
                      timestamp: val.lastPlaybackTime,
                      updatedAt: new Date(val.updatedAt).getTime(),
                    })
                  );
                }
              });
            }
            if (data.videoPlayback && typeof data.videoPlayback === 'object') {
              localStorage.setItem('preptea_video_playback_map', JSON.stringify(data.videoPlayback));
              Object.entries(data.videoPlayback).forEach(([vId, val]: [string, any]) => {
                if (val?.time && typeof val.time === 'number' && val.time > 0) {
                  localStorage.setItem(`preptea_video_time_${vId}`, String(val.time));
                }
              });
            }
            // Only fire event if content actually changed to avoid event bouncing loops
            if (changed) {
              window.dispatchEvent(new Event(SYNC_EVENT_NAME));
            }
          } catch (e) {
            // ignore localStorage errors
          }
        }
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
 * falling back to DB if needed.
 */
export async function getResumeTimestamp(
  videoId: string,
  courseSlug?: string
): Promise<number | null> {
  if (typeof window === 'undefined' || !videoId) return null;

  // 1. Check local storage first
  try {
    const local = localStorage.getItem(`preptea_video_time_${videoId}`);
    if (local) {
      const parsed = parseFloat(local);
      if (!isNaN(parsed) && parsed > 5) return parsed;
    }

    if (courseSlug) {
      const courseLocal = localStorage.getItem(`preptea_last_video_${courseSlug}`);
      if (courseLocal) {
        const parsed = JSON.parse(courseLocal);
        if (parsed.videoId === videoId && parsed.timestamp > 5) {
          return parsed.timestamp;
        }
      }
    }
  } catch (e) {}

  // 2. Fetch from DB if local storage was empty (e.g. user on another device)
  try {
    const data = await fetchUserProgressFromDb();
    if (data?.videoPlayback?.[videoId]?.time) {
      const dbTime = data.videoPlayback[videoId].time;
      if (dbTime > 5) return dbTime;
    }
    if (courseSlug && data?.coursesProgress?.[courseSlug]?.lastVideoId === videoId) {
      const dbCourseTime = data.coursesProgress[courseSlug].lastPlaybackTime;
      if (dbCourseTime > 5) return dbCourseTime;
    }
  } catch (e) {}

  return null;
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

/**
 * Auto-merge local offline data into MongoDB upon user session initialization
 */
export async function syncLocalProgressToDb(): Promise<void> {
  if (typeof window === 'undefined') return;

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

    if (completedVideos.length === 0 && studyDays.length === 0) {
      // Nothing offline to merge, just fetch from DB to populate local cache
      await fetchUserProgressFromDb();
      return;
    }

    const res = await fetch('/api/user/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_local',
        completedVideos,
        studyDays,
        clientDate: getLocalDateString(),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.completedVideos) {
        localStorage.setItem(LOCAL_COMPLETED_KEY, JSON.stringify(data.completedVideos));
        if (data.streak?.studyDays) {
          localStorage.setItem(
            LOCAL_STREAK_KEY,
            JSON.stringify({
              studyDays: data.streak.studyDays,
              lastUpdated: Date.now(),
            })
          );
        }
        window.dispatchEvent(new Event(SYNC_EVENT_NAME));
      }
    }
  } catch (e) {
    console.warn('Syncing local progress to DB failed:', e);
  }
}
