import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyAdminPermission } from '@/lib/adminAuth';
import { User } from '@/models/User';
import { RedeemCode } from '@/models/RedeemCode';
import { LaunchEvent } from '@/models/LaunchEvent';
import { PreApprovedEmail } from '@/models/PreApprovedEmail';
import { Attempt } from '@/models/Attempt';
import { QuestionStat } from '@/models/QuestionStat';
import { UserActivityLog } from '@/models/UserActivityLog';

// In-memory cache for admin dashboard stats (15 second TTL)
let cachedStats: any = null;
let lastStatsFetchTime = 0;
const STATS_CACHE_TTL_MS = 15000;

export async function GET(request: Request) {
  try {
    const session = await auth();
    const sessionUser = session?.user as any;
    const adminAuth = await verifyAdminPermission(sessionUser?.email);
    if (!adminAuth.isAuthorized) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.statusCode || 403 });
    }

    const now = Date.now();
    if (cachedStats && now - lastStatsFetchTime < STATS_CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        stats: cachedStats,
      });
    }

    // Execute count queries concurrently in parallel
    const [
      totalUsers,
      premiumUsers,
      totalCodes,
      activeEventsCount,
      totalAttempts,
      preapprovedCount,
      totalQuestionsTracked,
      totalActivityLogsCount,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isPremium: true }),
      RedeemCode.countDocuments(),
      LaunchEvent.countDocuments({ isActive: true }),
      Attempt.countDocuments(),
      PreApprovedEmail.countDocuments(),
      QuestionStat.countDocuments(),
      UserActivityLog.countDocuments(),
    ]);

    const statsPayload = {
      totalUsers,
      premiumUsers,
      freeUsers: totalUsers - premiumUsers,
      totalCodes,
      activeEventsCount,
      totalAttempts,
      preapprovedCount,
      totalQuestionsTracked,
      totalActivityLogsCount,
    };

    cachedStats = statsPayload;
    lastStatsFetchTime = now;

    return NextResponse.json({
      success: true,
      stats: statsPayload,
    }, {
      headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' }
    });
  } catch (error) {
    console.error('Error in admin stats API:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
