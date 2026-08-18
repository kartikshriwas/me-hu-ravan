import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { UserSession } from '@/models/UserSession';
import { UserActivityLog } from '@/models/UserActivityLog';

const SUPERADMIN_EMAIL = 'fykartik@gmail.com';

export async function GET(request: Request) {
  try {
    const sessionUser = getSessionFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const cleanEmail = sessionUser.email.toLowerCase().trim();
    const isSuperadmin = cleanEmail === SUPERADMIN_EMAIL;

    const conn = await connectToDatabase();
    if (!conn || conn.connection.readyState !== 1) {
      return NextResponse.json({
        success: true,
        sessions: [],
        stats: {
          onlineNowCount: 0,
          activeNowCount: 0,
          idleNowCount: 0,
          backgroundCount: 0,
          desktopCount: 0,
          mobileCount: 0,
          tabletCount: 0,
          totalActiveSecondsToday: 0,
          totalIdleSecondsToday: 0,
          totalFocusSecondsToday: 0,
          candidateCountToday: 0,
          avgActiveSecondsPerUser: 0,
          avgFocusSecondsPerUser: 0,
        },
        topPagesRightNow: [],
        topActiveUsersToday: [],
      });
    }

    // Fast-path: Check superadmin / admin role
    let isAdmin = isSuperadmin;
    if (!isAdmin) {
      const currentUser = await User.findOne({ email: cleanEmail }).select('role').lean();
      isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
    }

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // Sessions active within last 2.5 minutes (150,000 ms)
    const activeCutoff = new Date(Date.now() - 150000);

    const [activeSessions, todayLogs] = await Promise.all([
      UserSession.find({ lastHeartbeat: { $gte: activeCutoff }, terminated: { $ne: true } })
        .sort({ lastHeartbeat: -1 })
        .limit(150)
        .lean(),
      UserActivityLog.find({ dateStr: new Date().toISOString().split('T')[0] })
        .sort({ activeSeconds: -1 })
        .limit(50)
        .lean(),
    ]);

    // Query names & avatars for top active candidates today
    const topEmails = todayLogs.map((l) => l.userEmail);
    const topUserProfiles = await User.find({ email: { $in: topEmails } })
      .select('email name image')
      .lean();
    const userProfileMap = new Map(topUserProfiles.map((u) => [u.email.toLowerCase(), u]));

    // Active, Idle, and Device counts
    let activeNowCount = 0;
    let idleNowCount = 0;
    let backgroundCount = 0;
    let desktopCount = 0;
    let mobileCount = 0;
    let tabletCount = 0;

    const pageHitsMap: Record<string, { path: string; title: string; count: number }> = {};

    const formattedSessions = activeSessions.map((s) => {
      const isIdle = s.state === 'idle';
      const isBackground = s.state === 'background';

      if (isIdle) idleNowCount++;
      else if (isBackground) backgroundCount++;
      else activeNowCount++;

      if (s.deviceType === 'mobile') mobileCount++;
      else if (s.deviceType === 'tablet') tabletCount++;
      else desktopCount++;

      // Track active page hits
      const pathKey = s.currentPath || '/';
      if (!pageHitsMap[pathKey]) {
        pageHitsMap[pathKey] = { path: pathKey, title: s.pageTitle || pathKey, count: 0 };
      }
      pageHitsMap[pathKey].count++;

      const secondsSinceHeartbeat = Math.round((Date.now() - new Date(s.lastHeartbeat).getTime()) / 1000);

      return {
        id: s._id.toString(),
        sessionId: s.sessionId,
        userEmail: s.userEmail,
        userName: s.userName,
        userImage: s.userImage,
        currentPath: s.currentPath,
        pageTitle: s.pageTitle,
        state: s.state,
        activeSeconds: s.activeSeconds,
        idleSeconds: s.idleSeconds,
        focusSeconds: s.focusSeconds,
        lastSeenSecondsAgo: Math.max(0, secondsSinceHeartbeat),
        startedAt: new Date(s.startedAt).toISOString(),
        lastHeartbeat: new Date(s.lastHeartbeat).toISOString(),
        deviceType: s.deviceType || 'desktop',
        browser: s.browser || 'Chrome',
        os: s.os || 'Linux',
        screenResolution: s.screenResolution || '1920x1080',
        networkType: s.networkType || '4g',
        recentEvents: s.recentEvents || [],
        userAgent: s.userAgent,
      };
    });

    const topPagesRightNow = Object.values(pageHitsMap).sort((a, b) => b.count - a.count);

    // Summary usage analytics for today
    const totalActiveSecondsToday = todayLogs.reduce((sum, l) => sum + (l.activeSeconds || 0), 0);
    const totalIdleSecondsToday = todayLogs.reduce((sum, l) => sum + (l.idleSeconds || 0), 0);
    const totalFocusSecondsToday = todayLogs.reduce((sum, l) => sum + (l.focusSeconds || 0), 0);

    const candidateCountToday = todayLogs.length;
    const avgActiveSecondsPerUser = candidateCountToday > 0 ? Math.round(totalActiveSecondsToday / candidateCountToday) : 0;
    const avgFocusSecondsPerUser = candidateCountToday > 0 ? Math.round(totalFocusSecondsToday / candidateCountToday) : 0;

    return NextResponse.json({
      success: true,
      sessions: formattedSessions,
      stats: {
        onlineNowCount: formattedSessions.length,
        activeNowCount,
        idleNowCount,
        backgroundCount,
        desktopCount,
        mobileCount,
        tabletCount,
        totalActiveSecondsToday,
        totalIdleSecondsToday,
        totalFocusSecondsToday,
        candidateCountToday,
        avgActiveSecondsPerUser,
        avgFocusSecondsPerUser,
      },
      topPagesRightNow,
      topActiveUsersToday: todayLogs.map((l) => {
        const u = userProfileMap.get(l.userEmail.toLowerCase());
        return {
          userEmail: l.userEmail,
          userName: u?.name || l.userEmail.split('@')[0],
          userImage: u?.image || '',
          activeSeconds: l.activeSeconds || 0,
          idleSeconds: l.idleSeconds || 0,
          focusSeconds: l.focusSeconds || 0,
          lastActivePath: l.lastActivePath || '/',
        };
      }),
    });
  } catch (error) {
    return NextResponse.json({
      success: true,
      sessions: [],
      stats: {
        onlineNowCount: 0,
        activeNowCount: 0,
        idleNowCount: 0,
        backgroundCount: 0,
        desktopCount: 0,
        mobileCount: 0,
        tabletCount: 0,
        totalActiveSecondsToday: 0,
        totalIdleSecondsToday: 0,
        totalFocusSecondsToday: 0,
        candidateCountToday: 0,
        avgActiveSecondsPerUser: 0,
        avgFocusSecondsPerUser: 0,
      },
      topPagesRightNow: [],
      topActiveUsersToday: [],
    });
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = getSessionFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const cleanEmail = sessionUser.email.toLowerCase().trim();
    const isSuperadmin = cleanEmail === SUPERADMIN_EMAIL;

    const conn = await connectToDatabase();
    if (!conn || conn.connection.readyState !== 1) {
      return NextResponse.json({ success: false, error: 'Database connection offline' }, { status: 503 });
    }

    let isAdmin = isSuperadmin;
    if (!isAdmin) {
      const currentUser = await User.findOne({ email: cleanEmail }).select('role').lean();
      isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
    }

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, targetSessionId } = body;

    if (action === 'terminate' && targetSessionId) {
      await UserSession.updateOne({ sessionId: targetSessionId }, { $set: { terminated: true } });
      return NextResponse.json({ success: true, message: `Session ${targetSessionId} terminated successfully` });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Action failed' }, { status: 500 });
  }
}
