import { connectToDatabase } from '@/lib/db';
import { UserLearningProgress, IUserLearningProgress } from '@/models/UserLearningProgress';

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function computeStreak(studyDays: string[], referenceDateStr?: string) {
  const today = referenceDateStr && /^\d{4}-\d{2}-\d{2}$/.test(referenceDateStr)
    ? parseLocalDate(referenceDateStr)
    : new Date();

  const todayStr = getLocalDateString(today);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  const validDays = Array.from(
    new Set(studyDays.filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))
  ).sort();
  const daySet = new Set(validDays);

  const studiedToday = daySet.has(todayStr);

  let currentStreak = 0;

  if (studiedToday) {
    currentStreak = 1;
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 3650; i++) {
      const dStr = getLocalDateString(cursor);
      if (daySet.has(dStr)) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
  } else if (daySet.has(yesterdayStr)) {
    // Yesterday was studied, streak is alive for the rest of today
    currentStreak = 1;
    const cursor = new Date(yesterday);
    cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 3650; i++) {
      const dStr = getLocalDateString(cursor);
      if (daySet.has(dStr)) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
  } else {
    currentStreak = 0;
  }

  // Calculate all-time longest contiguous streak
  let maxStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  for (const dStr of validDays) {
    const curDate = parseLocalDate(dStr);

    if (prevDate) {
      const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    prevDate = curDate;
    if (tempStreak > maxStreak) {
      maxStreak = tempStreak;
    }
  }

  maxStreak = Math.max(maxStreak, currentStreak);

  // Monday to Sunday of the active week
  const currentDayOfWeek = (today.getDay() + 6) % 7; // 0 for Mon, 6 for Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - currentDayOfWeek);

  const activeDaysThisWeek = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    return daySet.has(getLocalDateString(d));
  });

  const lastStudiedDate = validDays.length > 0 ? validDays[validDays.length - 1] : '';

  return {
    currentStreak,
    longestStreak: maxStreak,
    studiedToday,
    activeDaysThisWeek,
    lastStudiedDate,
    totalActiveDays: validDays.length,
    sortedStudyDays: validDays,
  };
}

/**
 * Fetch or initialize UserLearningProgress document from MongoDB
 */
export async function getOrCreateUserLearningProgress(userEmail: string, clientDate?: string) {
  await connectToDatabase();
  const email = userEmail.toLowerCase().trim();

  let progress = await UserLearningProgress.findOne({ userEmail: email });
  if (!progress) {
    progress = await UserLearningProgress.create({
      userEmail: email,
      completedVideos: [],
      studyDays: [],
      totalVideosCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
    });
  }

  // Re-evaluate streak dynamically based on current date
  const streakCalc = computeStreak(progress.studyDays || [], clientDate);
  let changed = false;

  if (progress.currentStreak !== streakCalc.currentStreak) {
    progress.currentStreak = streakCalc.currentStreak;
    changed = true;
  }
  if (streakCalc.longestStreak > progress.longestStreak) {
    progress.longestStreak = streakCalc.longestStreak;
    changed = true;
  }
  if (changed) {
    await progress.save();
  }

  return { progress, streakCalc };
}

/**
 * Atomically record video completion and update study streak in MongoDB
 */
export async function recordVideoCompletionInDb(
  userEmail: string,
  params: {
    videoId: string;
    courseSlug?: string;
    duration?: number;
    clientDate?: string;
  }
) {
  await connectToDatabase();
  const email = userEmail.toLowerCase().trim();
  const { videoId, courseSlug, duration = 0, clientDate } = params;

  if (!videoId) throw new Error('videoId is required');

  const todayStr = clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)
    ? clientDate
    : getLocalDateString(new Date());

  const now = new Date();

  // Fetch current record
  const { progress } = await getOrCreateUserLearningProgress(email, todayStr);

  const isAlreadyCompleted = progress.completedVideos.includes(videoId);
  const updatedCompletedVideos = isAlreadyCompleted
    ? progress.completedVideos
    : [...progress.completedVideos, videoId];

  const updatedStudyDays = progress.studyDays.includes(todayStr)
    ? progress.studyDays
    : [...progress.studyDays, todayStr];

  const streakCalc = computeStreak(updatedStudyDays, todayStr);

  // Update Mongoose document
  progress.completedVideos = updatedCompletedVideos;
  progress.totalVideosCompleted = updatedCompletedVideos.length;
  progress.studyDays = updatedStudyDays;
  progress.currentStreak = streakCalc.currentStreak;
  progress.longestStreak = Math.max(progress.longestStreak, streakCalc.longestStreak);
  progress.lastStudiedDate = todayStr;
  progress.lastStudiedAt = now;

  // Record video playback state as completed
  if (!progress.videoPlayback) {
    progress.videoPlayback = new Map();
  }
  progress.videoPlayback.set(videoId, {
    time: duration > 0 ? duration : 0,
    duration: duration > 0 ? duration : 0,
    completed: true,
    updatedAt: now,
  });

  // Update course resume if courseSlug provided
  if (courseSlug) {
    if (!progress.coursesProgress) {
      progress.coursesProgress = new Map();
    }
    const currentCourse = progress.coursesProgress.get(courseSlug);
    progress.coursesProgress.set(courseSlug, {
      courseSlug,
      lastVideoId: videoId,
      lastVideoTitle: currentCourse?.lastVideoTitle || 'Lesson',
      lastPlaybackTime: duration > 0 ? duration : 0,
      lastDuration: duration > 0 ? duration : 0,
      updatedAt: now,
    });
  }

  await progress.save();

  return {
    progress,
    streakCalc,
    isNewlyCompleted: !isAlreadyCompleted,
  };
}

/**
 * Update playback progress timestamp and resume state in MongoDB
 */
export async function updatePlaybackHeartbeatInDb(
  userEmail: string,
  params: {
    videoId: string;
    courseSlug?: string;
    time: number;
    duration?: number;
    title?: string;
    deltaSeconds?: number;
  }
) {
  await connectToDatabase();
  const email = userEmail.toLowerCase().trim();
  const { videoId, courseSlug, time, duration = 0, title = '', deltaSeconds = 0 } = params;

  if (!videoId) throw new Error('videoId is required');

  const now = new Date();
  const { progress } = await getOrCreateUserLearningProgress(email);

  if (!progress.videoPlayback) {
    progress.videoPlayback = new Map();
  }

  const existingPlayback = progress.videoPlayback.get(videoId);
  const isCompleted = existingPlayback?.completed || (duration > 0 && time / duration >= 0.88);

  progress.videoPlayback.set(videoId, {
    time: Math.round(time * 10) / 10,
    duration: Math.round(duration * 10) / 10,
    completed: isCompleted,
    updatedAt: now,
  });

  if (deltaSeconds > 0) {
    progress.totalWatchTimeSeconds = (progress.totalWatchTimeSeconds || 0) + Math.round(deltaSeconds);
  }

  if (courseSlug) {
    if (!progress.coursesProgress) {
      progress.coursesProgress = new Map();
    }
    progress.coursesProgress.set(courseSlug, {
      courseSlug,
      lastVideoId: videoId,
      lastVideoTitle: title || 'Lesson',
      lastPlaybackTime: Math.round(time * 10) / 10,
      lastDuration: Math.round(duration * 10) / 10,
      updatedAt: now,
    });
  }

  await progress.save();
  return progress;
}

/**
 * Merge offline / local storage telemetry into MongoDB
 */
export async function mergeLocalProgressInDb(
  userEmail: string,
  params: {
    completedVideos?: string[];
    studyDays?: string[];
    maxStreak?: number;
    clientDate?: string;
  }
) {
  await connectToDatabase();
  const email = userEmail.toLowerCase().trim();
  const { completedVideos = [], studyDays = [], maxStreak = 0, clientDate } = params;

  const { progress } = await getOrCreateUserLearningProgress(email, clientDate);

  const mergedVideosSet = new Set([...progress.completedVideos, ...completedVideos]);
  const mergedDaysSet = new Set([
    ...progress.studyDays,
    ...studyDays.filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)),
  ]);

  const allStudyDays = Array.from(mergedDaysSet).sort();
  const streakCalc = computeStreak(allStudyDays, clientDate);

  progress.completedVideos = Array.from(mergedVideosSet);
  progress.totalVideosCompleted = progress.completedVideos.length;
  progress.studyDays = allStudyDays;
  progress.currentStreak = streakCalc.currentStreak;
  progress.longestStreak = Math.max(progress.longestStreak, maxStreak, streakCalc.longestStreak);

  await progress.save();
  return { progress, streakCalc };
}
