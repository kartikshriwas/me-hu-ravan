import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import { UserSession } from '@/models/UserSession';
import { UserActivityLog } from '@/models/UserActivityLog';
import { User } from '@/models/User';
import { processPendingDemoActivation } from '@/lib/pendingDemoHelper';
import { processAutoDemoGrant } from '@/lib/autoDemoHelper';
import { invalidateUserCourseCache } from '@/lib/coursesAuth';
import { createHash } from 'crypto';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

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
    const session = await auth();
  const sessionUser = session?.user as any;
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

    // M-7 + H-1: Rate limit heartbeat requests per session (60/min)
    const limiterKey = `heartbeat:${sessionId}`;
    const { allowed } = rateLimit(limiterKey, 60, 60_000);
    if (!allowed) {
      return NextResponse.json({ success: true }); // Silently accept to avoid client-side spam
    }

    const conn = await connectToDatabase();
    if (!conn || conn.connection.readyState !== 1) {
      // Return 200 with offline status so background beacon doesn't spam console
      return NextResponse.json({ success: false, offline: true });
    }

    const userEmail = sessionUser?.email ? sessionUser.email.toLowerCase().trim() : `guest_${sessionId.substring(0, 12)}`;
    const userName = sessionUser?.name || 'Guest User';
    const userImage = sessionUser?.image || '';
    const userAgent = request.headers.get('user-agent') || '';
    const rawIpRaw = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
    // Strip IPv4-mapped IPv6 prefix (::ffff:127.0.0.1 → 127.0.0.1)
    const rawIp = rawIpRaw.replace(/^::ffff:/i, '');
    const dailySalt = new Date().toISOString().split('T')[0];
    const hashedIp = rawIp ? createHash('sha256').update(rawIp + dailySalt).digest('hex').slice(0, 16) : '';
    const ipAddress = rawIp || hashedIp || '127.0.0.1';

    const { deviceType, browser, os } = parseUserAgent(userAgent);
    const validState = ['active', 'idle', 'focus', 'background'].includes(state) ? state : 'active';
    const activeAdd = Math.max(0, parseInt(activeDeltaSeconds) || 0);
    const idleAdd = Math.max(0, parseInt(idleDeltaSeconds) || 0);
    const focusAdd = Math.max(0, parseInt(focusDeltaSeconds) || 0);

    const now = new Date();

    // 1. Upsert live active session record with device & event telemetry (single atomic query)
    const updatedSession = await UserSession.findOneAndUpdate(
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
    ).select('terminated').lean();

    if (updatedSession?.terminated) {
      return NextResponse.json({ success: false, terminated: true, message: 'Session terminated by admin' });
    }

    let demoGranted = false;
    let demoExpired = false;
    let demoMinutes = 15;

    // Check demo status & pending demo grants for all users equally
    if (sessionUser?.email) {
      const plan = typeof sessionUser.premiumPlan === 'string' ? sessionUser.premiumPlan : '';
      const match = plan.match(/(\d+)m/);
      if (match) demoMinutes = parseInt(match[1]);

      const isDemoActive = plan.includes('demo') || plan.includes('m_demo');
      if (isDemoActive && sessionUser.premiumExpiresAt && new Date(sessionUser.premiumExpiresAt) <= now) {
        demoExpired = true;
        await User.updateOne(
          { email: userEmail },
          {
            $set: {
              isPremium: false,
              premiumPlan: `expired_demo:${demoMinutes}m`,
              allowedBatches: [],
              hasCourseAccess: false,
            }
          }
        ).catch(() => {});
        invalidateUserCourseCache(userEmail);
      } else if (plan.startsWith('expired_demo:')) {
        demoExpired = true;
      } else if (!sessionUser.isPremium && !sessionUser.hasHadDemoOrPremium && sessionUser.role !== 'admin' && sessionUser.role !== 'superadmin') {
        // Only query for auto-demo for genuine first-time normal users
        const dbUser = await User.findOne({ email: userEmail }).select('_id email role isPremium premiumPlan allowedBatches hasHadDemoOrPremium premiumExpiresAt isAlt lastIp').lean();
        if (dbUser && !dbUser.isAlt) {
          const wasPendingActivated = await processPendingDemoActivation(dbUser);
          const wasAutoGranted = await processAutoDemoGrant(dbUser, ipAddress);
          if (wasPendingActivated || wasAutoGranted) {
            demoGranted = true;
          }
        }
      }
    }

    // 2. Aggregate daily usage logs if user is logged in (excluding /admin panel routes from student study metrics)
    const isAdminPath = currentPath && currentPath.startsWith('/admin');
    if (sessionUser?.email && !isAdminPath) {
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

    return NextResponse.json({ success: true, terminated: false, demoGranted, demoExpired, demoMinutes });
  } catch (error) {
    // Fail background heartbeat gracefully without throwing console errors
    return NextResponse.json({ success: false, error: 'Network/DB timeout' }, { status: 200 });
  }
}
