import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { verifyAdminPermission } from '@/lib/adminAuth';
import { UserSession } from '@/models/UserSession';
import { UserActivityLog } from '@/models/UserActivityLog';
import { User } from '@/models/User';

export async function GET(request: Request) {
  try {
    const sessionUser = getSessionFromRequest(request);
    const auth = await verifyAdminPermission(sessionUser?.email, 'manage_users');
    if (!auth.isAuthorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode || 403 });
    }
    // Sessions active within last 2.5 minutes (150,000 ms)

    // Sessions active within last 2.5 minutes (150,000 ms)
    const activeCutoff = new Date(Date.now() - 150000);

    const now = new Date();
    const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

    const todayStr = formatDateStr(now);

    // Yesterday
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayStr = formatDateStr(yesterdayDate);

    // Monday of current week
    const currentDayOfWeek = now.getDay();
    const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const mondayThisWeek = new Date(now);
    mondayThisWeek.setDate(now.getDate() + diffToMonday);
    const mondayThisWeekStr = formatDateStr(mondayThisWeek);

    // Last week (Monday to Sunday)
    const mondayLastWeek = new Date(mondayThisWeek);
    mondayLastWeek.setDate(mondayThisWeek.getDate() - 7);
    const mondayLastWeekStr = formatDateStr(mondayLastWeek);

    const sundayLastWeek = new Date(mondayThisWeek);
    sundayLastWeek.setDate(mondayThisWeek.getDate() - 1);
    const sundayLastWeekStr = formatDateStr(sundayLastWeek);

    // First day of current month
    const yearNow = now.getFullYear();
    const monthNow = now.getMonth();
    const firstDayThisMonthStr = `${yearNow}-${String(monthNow + 1).padStart(2, '0')}-01`;

    // Last Month (1st to last day of previous month)
    const firstDayLastMonth = new Date(yearNow, monthNow - 1, 1);
    const lastDayLastMonth = new Date(yearNow, monthNow, 0);
    const firstDayLastMonthStr = formatDateStr(firstDayLastMonth);
    const lastDayLastMonthStr = formatDateStr(lastDayLastMonth);

    // This Year (Jan 1 to today)
    const firstDayThisYearStr = `${yearNow}-01-01`;

    // Last Year (Jan 1 to Dec 31 of previous year)
    const firstDayLastYearStr = `${yearNow - 1}-01-01`;
    const lastDayLastYearStr = `${yearNow - 1}-12-31`;

    const aggregateUserActivity = async (matchFilter: any) => {
      return UserActivityLog.aggregate([
        {
          $match: {
            ...matchFilter,
            lastActivePath: { $not: /^\/admin/i },
          },
        },
        {
          $group: {
            _id: '$userEmail',
            activeSeconds: { $sum: '$activeSeconds' },
            idleSeconds: { $sum: '$idleSeconds' },
            focusSeconds: { $sum: '$focusSeconds' },
            lastActivePath: { $last: '$lastActivePath' },
          },
        },
        { $sort: { activeSeconds: -1 } },
        { $limit: 20 },
      ]);
    };

    const [
      activeSessions,
      todayLogsAgg,
      yesterdayLogsAgg,
      thisWeekLogsAgg,
      lastWeekLogsAgg,
      thisMonthLogsAgg,
      lastMonthLogsAgg,
      thisYearLogsAgg,
      lastYearLogsAgg,
      allTimeLogsAgg,
      allTimeTopUsersFromDb,
    ] = await Promise.all([
      UserSession.find({ lastHeartbeat: { $gte: activeCutoff }, terminated: { $ne: true } })
        .sort({ lastHeartbeat: -1 })
        .limit(150)
        .lean(),
      aggregateUserActivity({ dateStr: todayStr }),
      aggregateUserActivity({ dateStr: yesterdayStr }),
      aggregateUserActivity({ dateStr: { $gte: mondayThisWeekStr, $lte: todayStr } }),
      aggregateUserActivity({ dateStr: { $gte: mondayLastWeekStr, $lte: sundayLastWeekStr } }),
      aggregateUserActivity({ dateStr: { $gte: firstDayThisMonthStr, $lte: todayStr } }),
      aggregateUserActivity({ dateStr: { $gte: firstDayLastMonthStr, $lte: lastDayLastMonthStr } }),
      aggregateUserActivity({ dateStr: { $gte: firstDayThisYearStr, $lte: todayStr } }),
      aggregateUserActivity({ dateStr: { $gte: firstDayLastYearStr, $lte: lastDayLastYearStr } }),
      aggregateUserActivity({}),
      User.find().sort({ totalScore: -1, testsCompleted: -1 }).limit(20).select('email name image totalScore testsCompleted').lean(),
    ]);

    // Query profiles for candidates across all timeframes
    const allEmails = Array.from(
      new Set([
        ...todayLogsAgg.map((l) => l._id),
        ...yesterdayLogsAgg.map((l) => l._id),
        ...thisWeekLogsAgg.map((l) => l._id),
        ...lastWeekLogsAgg.map((l) => l._id),
        ...thisMonthLogsAgg.map((l) => l._id),
        ...lastMonthLogsAgg.map((l) => l._id),
        ...thisYearLogsAgg.map((l) => l._id),
        ...lastYearLogsAgg.map((l) => l._id),
        ...allTimeLogsAgg.map((l) => l._id),
        ...allTimeTopUsersFromDb.map((u) => u.email),
      ])
    );

    const topUserProfiles = await User.find({ email: { $in: allEmails } })
      .select('email name image totalScore testsCompleted')
      .lean();
    const userProfileMap = new Map(topUserProfiles.map((u) => [u.email.toLowerCase(), u]));

    const formatAggList = (list: any[]) =>
      list.map((l) => {
        const u = userProfileMap.get(l._id.toLowerCase());
        return {
          userEmail: l._id,
          userName: u?.name || l._id.split('@')[0],
          userImage: u?.image || '',
          activeSeconds: l.activeSeconds || 0,
          idleSeconds: l.idleSeconds || 0,
          focusSeconds: l.focusSeconds || 0,
          lastActivePath: l.lastActivePath || '/',
          totalScore: u?.totalScore || 0,
          testsCompleted: u?.testsCompleted || 0,
        };
      });

    // Build All-Time list: combine activity logs with overall user scores
    const allTimeCombinedMap = new Map<string, any>();
    allTimeLogsAgg.forEach((l) => {
      const u = userProfileMap.get(l._id.toLowerCase());
      allTimeCombinedMap.set(l._id.toLowerCase(), {
        userEmail: l._id,
        userName: u?.name || l._id.split('@')[0],
        userImage: u?.image || '',
        activeSeconds: l.activeSeconds || 0,
        idleSeconds: l.idleSeconds || 0,
        focusSeconds: l.focusSeconds || 0,
        lastActivePath: l.lastActivePath || '/',
        totalScore: u?.totalScore || 0,
        testsCompleted: u?.testsCompleted || 0,
      });
    });

    allTimeTopUsersFromDb.forEach((u) => {
      const existing = allTimeCombinedMap.get(u.email.toLowerCase());
      if (!existing) {
        allTimeCombinedMap.set(u.email.toLowerCase(), {
          userEmail: u.email,
          userName: u.name || u.email.split('@')[0],
          userImage: u.image || '',
          activeSeconds: 0,
          idleSeconds: 0,
          focusSeconds: 0,
          lastActivePath: '/',
          totalScore: u.totalScore || 0,
          testsCompleted: u.testsCompleted || 0,
        });
      }
    });

    const allTimeList = Array.from(allTimeCombinedMap.values()).sort((a, b) => {
      if (b.activeSeconds !== a.activeSeconds) return b.activeSeconds - a.activeSeconds;
      return (b.totalScore || 0) - (a.totalScore || 0);
    });

    const topUsersByTimeframe = {
      today: formatAggList(todayLogsAgg),
      yesterday: formatAggList(yesterdayLogsAgg),
      thisWeek: formatAggList(thisWeekLogsAgg),
      lastWeek: formatAggList(lastWeekLogsAgg),
      thisMonth: formatAggList(thisMonthLogsAgg),
      lastMonth: formatAggList(lastMonthLogsAgg),
      thisYear: formatAggList(thisYearLogsAgg),
      lastYear: formatAggList(lastYearLogsAgg),
      allTime: allTimeList,
    };

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
    const totalActiveSecondsToday = todayLogsAgg.reduce((sum, l) => sum + (l.activeSeconds || 0), 0);
    const totalIdleSecondsToday = todayLogsAgg.reduce((sum, l) => sum + (l.idleSeconds || 0), 0);
    const totalFocusSecondsToday = todayLogsAgg.reduce((sum, l) => sum + (l.focusSeconds || 0), 0);

    const candidateCountToday = todayLogsAgg.length;
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
      topActiveUsersToday: topUsersByTimeframe.today,
      topUsersByTimeframe,
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
    const auth = await verifyAdminPermission(sessionUser?.email, 'manage_users');
    if (!auth.isAuthorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode || 403 });
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
