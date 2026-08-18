import { NextResponse } from 'next/server';
import { getAllAssessments } from '@/lib/questionsData';
import { connectToDatabase } from '@/lib/db';
import { Attempt } from '@/models/Attempt';
import { cleanQuizId } from '@/lib/storage';

// 30-Second TTL Cache for questions list API to eliminate repetitive aggregation & disk reading
let cachedQuestionsResponse: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30000;

export async function GET() {
  try {
    const now = Date.now();
    if (cachedQuestionsResponse && now - lastCacheTime < CACHE_TTL_MS) {
      return NextResponse.json(cachedQuestionsResponse, {
        headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' }
      });
    }

    const assessments = getAllAssessments();
    const conn = await connectToDatabase();

    const attemptsMap: Record<string, { count: number; avgAccuracy: number }> = {};

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
      ]);

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
