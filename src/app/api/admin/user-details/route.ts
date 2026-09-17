import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyAdminPermission } from '@/lib/adminAuth';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { UserSession } from '@/models/UserSession';
import { UserActivityLog } from '@/models/UserActivityLog';
import { Attempt } from '@/models/Attempt';
import { RedeemCode } from '@/models/RedeemCode';
import { LaunchEvent } from '@/models/LaunchEvent';
import { PreApprovedEmail } from '@/models/PreApprovedEmail';

export async function GET(request: Request) {
  try {
    const session = await auth();
  const sessionUser = session?.user as any;
    const adminAuth = await verifyAdminPermission(sessionUser?.email, 'manage_users');
    if (!adminAuth.isAuthorized) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.statusCode || 403 });
    }

    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get('email');

    if (!emailParam) {
      return NextResponse.json({ success: false, error: 'Target candidate email parameter required' }, { status: 400 });
    }

    const emailLower = emailParam.toLowerCase().trim();

    const conn = await connectToDatabase();
    if (!conn || conn.connection.readyState !== 1) {
      return NextResponse.json({ success: false, error: 'Database connection offline' }, { status: 503 });
    }

    // Query all MongoDB user-related collections in parallel
    const [
      userDoc,
      liveSessions,
      activityLogs,
      attempts,
      redeemCodes,
      claimedEvents,
      preApprovedRecord,
    ] = await Promise.all([
      User.findOne({ email: emailLower }).lean(),
      UserSession.find({ userEmail: emailLower }).sort({ lastHeartbeat: -1 }).limit(50).lean(),
      UserActivityLog.find({ userEmail: emailLower }).sort({ dateStr: -1 }).limit(100).lean(),
      Attempt.find({ userEmail: emailLower }).sort({ createdAt: -1 }).limit(100).lean(),
      RedeemCode.find({ 'usedBy.userEmail': emailLower }).lean(),
      LaunchEvent.find({ 'claimedUsers.userEmail': emailLower }).lean(),
      PreApprovedEmail.findOne({ email: emailLower }).lean(),
    ]);

    // Compute lifetime aggregated telemetry stats
    const lifetimeActiveSeconds = activityLogs.reduce((acc, curr) => acc + (curr.activeSeconds || 0), 0);
    const lifetimeFocusSeconds = activityLogs.reduce((acc, curr) => acc + (curr.focusSeconds || 0), 0);
    const lifetimeIdleSeconds = activityLogs.reduce((acc, curr) => acc + (curr.idleSeconds || 0), 0);
    const lifetimeHeartbeats = activityLogs.reduce((acc, curr) => acc + (curr.heartbeatsCount || 0), 0);
    const totalDaysActive = activityLogs.length;

    // Calculate overall average test score & accuracy from attempts
    const totalAttempts = attempts.length;
    const avgScore = totalAttempts > 0 ? (attempts.reduce((a, c) => a + (c.score || 0), 0) / totalAttempts).toFixed(1) : '0';
    const avgAccuracy = totalAttempts > 0 ? (attempts.reduce((a, c) => a + (c.accuracy || 0), 0) / totalAttempts).toFixed(1) : '0';

    return NextResponse.json({
      success: true,
      user: userDoc || {
        email: emailLower,
        name: emailLower.split('@')[0],
        role: 'user',
        isPremium: false,
        adminPermissions: [],
        allowedBatches: [],
        totalScore: 0,
        testsCompleted: 0,
      },
      sessions: liveSessions || [],
      activityLogs: activityLogs || [],
      attempts: attempts || [],
      redeemCodes: redeemCodes || [],
      claimedEvents: claimedEvents || [],
      preApprovedRecord: preApprovedRecord || null,
      stats: {
        lifetimeActiveSeconds,
        lifetimeFocusSeconds,
        lifetimeIdleSeconds,
        lifetimeHeartbeats,
        totalDaysActive,
        totalAttempts,
        avgScore: parseFloat(avgScore),
        avgAccuracy: parseFloat(avgAccuracy),
      },
    });
  } catch (error: any) {
    console.error('Error fetching candidate 360 details:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
