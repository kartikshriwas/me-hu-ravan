import { NextResponse } from 'next/server';
import { getAllAssessments } from '@/lib/questionsData';
import { connectToDatabase, resetDatabaseConnection } from '@/lib/db';
import { Attempt } from '@/models/Attempt';
import { cleanQuizId } from '@/lib/storage';
import { auth } from '@/auth';

// 30-Second TTL Cache for questions list API to eliminate repetitive aggregation & disk reading
let cachedQuestionsResponse: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30000;

export async function GET() {
  try {
    // // M-3: Require authentication to view assessment catalog
    // const session = await auth();
    // if (!session?.user) {
    //   return NextResponse.json(
    //     { success: false, error: 'Authentication required' },
    //     { status: 401 }
    //   );
    // }

    const now = Date.now();
    if (cachedQuestionsResponse && now - lastCacheTime < CACHE_TTL_MS) {
      return NextResponse.json(cachedQuestionsResponse, {
        headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' }
      });
    }

    const assessments = getAllAssessments();
    const attemptsMap: Record<string, { count: number; avgAccuracy: number }> = {};

    try {
      const conn = await connectToDatabase();
      if (conn) {
        const stats = await Attempt.aggregate([
          { $match: { isFirstAttempt: { $ne: false } } },
          {
            $group: {
              _id: "$quizId",
              count: { $sum: 1 },
              avgAccuracy: { $avg: "$accuracy" }
            }
          }
        ]).option({ maxTimeMS: 5000 });

        stats.forEach((s) => {
          if (s._id) {
            const cleanKey = cleanQuizId(s._id);
            attemptsMap[cleanKey] = {
              count: s.count || 0,
              avgAccuracy: Math.round(s.avgAccuracy || 0)
            };
            attemptsMap[s._id] = attemptsMap[cleanKey];
          }
        });
      }
    } catch (dbErr: any) {
      if (dbErr?.name === 'MongooseServerSelectionError') {
        await resetDatabaseConnection().catch(() => {});
      }
      console.warn('[Questions API] Could not aggregate attempt stats, using static assessments catalog:', dbErr?.message || dbErr);
    }

    const enriched = assessments.map((t) => {
      const cleanKey = cleanQuizId(t.quizId);
      const stat = attemptsMap[cleanKey] || attemptsMap[t.quizId] || { count: 0, avgAccuracy: 0 };
      return {
        ...t,
        candidateCount: stat.count,
        avgAccuracy: stat.avgAccuracy,
      };
    });

    cachedQuestionsResponse = { success: true, data: enriched };
    lastCacheTime = now;

    return NextResponse.json(cachedQuestionsResponse, {
      headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' }
    });
  } catch (error) {
    console.error('Error fetching tests:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch practice tests' }, { status: 500 });
  }
}
