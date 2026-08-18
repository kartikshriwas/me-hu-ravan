import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { UserSession } from '@/models/UserSession';
import { UserActivityLog } from '@/models/UserActivityLog';

function parseUserAgent(ua: string) {
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  const uaLower = ua.toLowerCase();

  // Device detection
  if (uaLower.includes('ipad') || uaLower.includes('tablet')) {
    deviceType = 'tablet';
  } else if (uaLower.includes('mobile') || uaLower.includes('iphone') || uaLower.includes('android')) {
    deviceType = 'mobile';
  }

  // OS detection
  if (uaLower.includes('windows')) os = 'Windows';
  else if (uaLower.includes('mac os')) os = 'macOS';
  else if (uaLower.includes('linux')) os = 'Linux';
  else if (uaLower.includes('android')) os = 'Android';
  else if (uaLower.includes('iphone') || uaLower.includes('ipad')) os = 'iOS';

  // Browser detection
  if (uaLower.includes('edg')) browser = 'Edge';
  else if (uaLower.includes('chrome')) browser = 'Chrome';
  else if (uaLower.includes('firefox')) browser = 'Firefox';
  else if (uaLower.includes('safari')) browser = 'Safari';

  return { deviceType, browser, os };
}

export async function POST(request: Request) {
  try {
    const sessionUser = getSessionFromRequest(request);
    const body = await request.json();

    const {
      sessionId,
      currentPath,
      pageTitle,
      state,
      activeDeltaSeconds,
      idleDeltaSeconds,
      focusDeltaSeconds,
      screenResolution,
      networkType,
      recentEvents,
    } = body;

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Session ID required' }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (!conn || conn.connection.readyState !== 1) {
      // Return 200 with offline status so background beacon doesn't spam console
      return NextResponse.json({ success: false, offline: true });
    }

    // Check if session was terminated by admin
    const existingSession = await UserSession.findOne({ sessionId }).select('terminated').lean();
    if (existingSession?.terminated) {
      return NextResponse.json({ success: false, terminated: true, message: 'Session terminated by admin' });
    }

    const userEmail = sessionUser?.email ? sessionUser.email.toLowerCase().trim() : `guest_${sessionId.substring(0, 12)}`;
    const userName = sessionUser?.name || 'Guest User';
    const userImage = sessionUser?.image || '';
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';

    const { deviceType, browser, os } = parseUserAgent(userAgent);
    const validState = ['active', 'idle', 'focus', 'background'].includes(state) ? state : 'active';
    const activeAdd = Math.max(0, parseInt(activeDeltaSeconds) || 0);
    const idleAdd = Math.max(0, parseInt(idleDeltaSeconds) || 0);
    const focusAdd = Math.max(0, parseInt(focusDeltaSeconds) || 0);

    const now = new Date();

    // 1. Upsert live active session record with device & event telemetry
    await UserSession.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          userEmail,
          userName,
          userImage,
          currentPath: currentPath || '/',
          pageTitle: pageTitle || 'PrepTea',
          state: validState,
          lastHeartbeat: now,
          deviceType,
          browser,
          os,
          screenResolution: screenResolution || '1920x1080',
          networkType: networkType || '4g',
          userAgent,
          ipAddress,
          ...(Array.isArray(recentEvents) && recentEvents.length > 0 ? { recentEvents: recentEvents.slice(-20) } : {}),
        },
        $inc: {
          activeSeconds: activeAdd,
          idleSeconds: idleAdd,
          focusSeconds: focusAdd,
        },
        $setOnInsert: {
          startedAt: now,
          terminated: false,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // 2. Aggregate daily usage logs if user is logged in
    if (sessionUser?.email) {
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      await UserActivityLog.findOneAndUpdate(
        { userEmail, dateStr },
        {
          $inc: {
            activeSeconds: activeAdd,
            idleSeconds: idleAdd,
            focusSeconds: focusAdd,
            heartbeatsCount: 1,
          },
          $set: {
            lastActivePath: currentPath || '/',
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    return NextResponse.json({ success: true, terminated: false });
  } catch (error) {
    // Fail background heartbeat gracefully without throwing console errors
    return NextResponse.json({ success: false, error: 'Network/DB timeout' }, { status: 200 });
  }
}
