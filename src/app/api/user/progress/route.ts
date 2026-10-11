import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getOrCreateUserLearningProgress,
  recordVideoCompletionInDb,
  updatePlaybackHeartbeatInDb,
  mergeLocalProgressInDb,
} from '@/lib/learningProgressHelper';

export async function GET(request: Request) {
  try {
    const session = await auth();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Sign in required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const clientDate = searchParams.get('clientDate') || undefined;

    const { progress, streakCalc } = await getOrCreateUserLearningProgress(userEmail, clientDate);

    // Convert Maps to plain JavaScript objects for JSON serialization
    const coursesProgressObj: Record<string, any> = {};
    if (progress.coursesProgress) {
      progress.coursesProgress.forEach((val, key) => {
        coursesProgressObj[key] = val;
      });
    }

    const videoPlaybackObj: Record<string, any> = {};
    if (progress.videoPlayback) {
      progress.videoPlayback.forEach((val, key) => {
        videoPlaybackObj[key] = val;
      });
    }

    return NextResponse.json({
      success: true,
      completedVideos: progress.completedVideos || [],
      totalVideosCompleted: progress.totalVideosCompleted || (progress.completedVideos || []).length,
      streak: {
        currentStreak: streakCalc.currentStreak,
        longestStreak: streakCalc.longestStreak,
        studiedToday: streakCalc.studiedToday,
        activeDaysThisWeek: streakCalc.activeDaysThisWeek,
        lastStudiedDate: streakCalc.lastStudiedDate,
        totalActiveDays: streakCalc.totalActiveDays,
        studyDays: streakCalc.sortedStudyDays,
      },
      coursesProgress: coursesProgressObj,
      videoPlayback: videoPlaybackObj,
      totalWatchTimeSeconds: progress.totalWatchTimeSeconds || 0,
      updatedAt: progress.updatedAt,
    });
  } catch (error: any) {
    console.error('Error fetching user learning progress from MongoDB:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch learning progress' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Sign in required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'video_complete') {
      const { videoId, courseSlug, duration, clientDate } = body;
      if (!videoId) {
        return NextResponse.json(
          { success: false, error: 'Missing videoId' },
          { status: 400 }
        );
      }

      const result = await recordVideoCompletionInDb(userEmail, {
        videoId,
        courseSlug,
        duration,
        clientDate,
      });

      return NextResponse.json({
        success: true,
        isNewlyCompleted: result.isNewlyCompleted,
        completedVideos: result.progress.completedVideos,
        streak: {
          currentStreak: result.streakCalc.currentStreak,
          longestStreak: result.streakCalc.longestStreak,
          studiedToday: result.streakCalc.studiedToday,
          activeDaysThisWeek: result.streakCalc.activeDaysThisWeek,
          studyDays: result.streakCalc.sortedStudyDays,
        },
      });
    }

    if (action === 'playback_progress') {
      const { videoId, courseSlug, time, duration, title, deltaSeconds } = body;
      if (!videoId) {
        return NextResponse.json(
          { success: false, error: 'Missing videoId' },
          { status: 400 }
        );
      }

      const progress = await updatePlaybackHeartbeatInDb(userEmail, {
        videoId,
        courseSlug,
        time: typeof time === 'number' ? time : 0,
        duration,
        title,
        deltaSeconds,
      });

      return NextResponse.json({
        success: true,
        updatedAt: progress.updatedAt,
      });
    }

    if (action === 'sync_local') {
      const { completedVideos, studyDays, maxStreak, clientDate } = body;

      const result = await mergeLocalProgressInDb(userEmail, {
        completedVideos: Array.isArray(completedVideos) ? completedVideos : [],
        studyDays: Array.isArray(studyDays) ? studyDays : [],
        maxStreak: typeof maxStreak === 'number' ? maxStreak : 0,
        clientDate,
      });

      return NextResponse.json({
        success: true,
        completedVideos: result.progress.completedVideos,
        totalVideosCompleted: result.progress.totalVideosCompleted,
        streak: {
          currentStreak: result.streakCalc.currentStreak,
          longestStreak: result.streakCalc.longestStreak,
          studiedToday: result.streakCalc.studiedToday,
          activeDaysThisWeek: result.streakCalc.activeDaysThisWeek,
          studyDays: result.streakCalc.sortedStudyDays,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid or missing action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error recording learning progress to MongoDB:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update learning progress' },
      { status: 500 }
    );
  }
}
