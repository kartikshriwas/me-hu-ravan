import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { verifyAdminPermission } from '@/lib/adminAuth';
import { User } from '@/models/User';
import { RedeemCode } from '@/models/RedeemCode';
import { LaunchEvent } from '@/models/LaunchEvent';
import { PreApprovedEmail } from '@/models/PreApprovedEmail';
import { Attempt } from '@/models/Attempt';
import { QuestionStat } from '@/models/QuestionStat';
import { UserActivityLog } from '@/models/UserActivityLog';

export async function GET(request: Request) {
  try {
    const sessionUser = getSessionFromRequest(request);
    const auth = await verifyAdminPermission(sessionUser?.email);
    if (!auth.isAuthorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode || 403 });
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

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        premiumUsers,
        freeUsers: totalUsers - premiumUsers,
        totalCodes,
        activeEventsCount,
        totalAttempts,
        preapprovedCount,
        totalQuestionsTracked,
        totalActivityLogsCount,
      },
    });
  } catch (error) {
    console.error('Error in admin stats API:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
