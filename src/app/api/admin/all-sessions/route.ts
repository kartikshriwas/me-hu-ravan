import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyAdminPermission } from '@/lib/adminAuth';
import { UserSession } from '@/models/UserSession';
import { connectToDatabase } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await auth();
    const sessionUser = session?.user as any;
    const adminAuth = await verifyAdminPermission(sessionUser?.email, 'manage_users');
    if (!adminAuth.isAuthorized) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.statusCode || 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const emailQuery = searchParams.get('email')?.toLowerCase().trim();
    const statusFilter = searchParams.get('status'); // 'active', 'offline', 'terminated', 'all'
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    const queryFilter: any = {};

    if (emailQuery) {
      queryFilter.$or = [
        { userEmail: { $regex: emailQuery, $options: 'i' } },
        { userName: { $regex: emailQuery, $options: 'i' } }
      ];
    }

    const now = Date.now();
    const activeCutoff = new Date(now - 150000); // 2.5 mins

    if (statusFilter === 'active') {
      queryFilter.lastHeartbeat = { $gte: activeCutoff };
      queryFilter.terminated = { $ne: true };
    } else if (statusFilter === 'offline') {
      queryFilter.lastHeartbeat = { $lt: activeCutoff };
      queryFilter.terminated = { $ne: true };
    } else if (statusFilter === 'terminated') {
      queryFilter.terminated = true;
    } else if (statusFilter === 'all_with_terminated') {
      // Includes terminated sessions log
    } else {
      // Default ('all'): Show all valid non-terminated sessions (Live Online + Past Offline)
      queryFilter.terminated = { $ne: true };
    }

    const sessions = await UserSession.find(queryFilter)
      .sort({ lastHeartbeat: -1 })
      .limit(Math.min(limit, 500))
      .lean();

    const formattedSessions = sessions.map((s) => {
      const lastHbTime = new Date(s.lastHeartbeat).getTime();
      const secondsAgo = Math.max(0, Math.round((now - lastHbTime) / 1000));
      const isOnline = !s.terminated && secondsAgo <= 150;

      let displayStatus: 'active' | 'focus' | 'idle' | 'background' | 'offline' | 'terminated' = 'offline';
      if (s.terminated) {
        displayStatus = 'terminated';
      } else if (isOnline) {
        displayStatus = s.state || 'active';
      } else {
        displayStatus = 'offline';
      }

      return {
        id: s._id.toString(),
        sessionId: s.sessionId,
        userEmail: s.userEmail,
        userName: s.userName || s.userEmail?.split('@')[0] || 'User',
        userImage: s.userImage || '',
        currentPath: s.currentPath || '/',
        pageTitle: s.pageTitle || '',
        state: displayStatus,
        activeSeconds: s.activeSeconds || 0,
        idleSeconds: s.idleSeconds || 0,
        focusSeconds: s.focusSeconds || 0,
        lastSeenSecondsAgo: secondsAgo,
        startedAt: s.startedAt ? new Date(s.startedAt).toISOString() : new Date((s as any).createdAt || Date.now()).toISOString(),
        lastHeartbeat: new Date(s.lastHeartbeat).toISOString(),
        deviceType: s.deviceType || 'desktop',
        browser: s.browser || 'Chrome',
        os: s.os || 'Linux',
        screenResolution: s.screenResolution || '1920x1080',
        networkType: s.networkType || '4g',
        terminated: !!s.terminated,
        ipAddress: s.ipAddress || '',
      };
    });

    // Summary counts
    const totalCount = await UserSession.countDocuments(emailQuery ? queryFilter : {});
    const activeCount = await UserSession.countDocuments({ lastHeartbeat: { $gte: activeCutoff }, terminated: { $ne: true } });
    const offlineCount = await UserSession.countDocuments({ lastHeartbeat: { $lt: activeCutoff }, terminated: { $ne: true } });
    const terminatedCount = await UserSession.countDocuments({ terminated: true });

    return NextResponse.json({
      success: true,
      sessions: formattedSessions,
      stats: {
        total: totalCount,
        active: activeCount,
        offline: offlineCount,
        terminated: terminatedCount,
      }
    });
  } catch (error) {
    console.error('Error fetching all user sessions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch sessions log' }, { status: 500 });
  }
}
