import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { Attempt } from '@/models/Attempt';
import { isPlatformGlobalFree } from '@/lib/globalSetting';
import { isCourseBatch } from '@/lib/batchAccess';
import { SUPERADMIN_EMAIL } from '@/lib/adminAuth';

export async function GET(request: Request) {
  try {
    const session = await auth();
  const sessionUser = session?.user as any;
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const cleanEmail = sessionUser.email.toLowerCase().trim();
    const isSuperadmin = cleanEmail === SUPERADMIN_EMAIL;

    await connectToDatabase();

    // Execute User query, recent Attempts fetch, and GlobalFree check in parallel
    const [dbUser, attempts, globalFreeConfig] = await Promise.all([
      User.findOne({ email: cleanEmail }).select('_id name email image role adminPermissions allowedBatches isPremium premiumExpiresAt premiumPlan totalScore testsCompleted averageAccuracy createdAt').lean(),
      Attempt.find({ userEmail: cleanEmail }).select('_id quizId quizTitle score maxScore accuracy isFirstAttempt timestamp createdAt').sort({ createdAt: -1 }).limit(50).lean(),
      isPlatformGlobalFree(),
    ]);

    // Calculate accurate global rank matching leaderboard rules (sorted by totalScore desc, averageAccuracy desc)
    let userRank = 0;
    if (dbUser) {
      const userScore = dbUser.totalScore || 0;
      const userAccuracy = dbUser.averageAccuracy || 0;

      if (userScore > 0) {
        const higherScorers = await User.countDocuments({
          $or: [
            { totalScore: { $gt: userScore } },
            { totalScore: userScore, averageAccuracy: { $gt: userAccuracy } }
          ]
        });
        userRank = higherScorers + 1;
      } else {
        const usersWithPoints = await User.countDocuments({ totalScore: { $gt: 0 } });
        userRank = usersWithPoints + 1;
      }
    }

    const isGlobalFree = globalFreeConfig.isGlobalFree;
    const globalFreeUntil = globalFreeConfig.freeUntil;
    let isPremium = dbUser?.isPremium || isSuperadmin || isGlobalFree;
    let premiumExpiresAt = dbUser?.premiumExpiresAt || null;
    let premiumPlan = dbUser?.premiumPlan || (isSuperadmin ? 'superadmin' : 'free');

    if (!dbUser?.isPremium && !isSuperadmin && isGlobalFree) {
      if (globalFreeUntil) {
        premiumExpiresAt = globalFreeUntil;
      }
      if (premiumPlan === 'free') {
        premiumPlan = 'Global Free Access';
      }
    }

    if (isPremium && !isSuperadmin && !isGlobalFree && premiumExpiresAt && new Date(premiumExpiresAt) < new Date()) {
      isPremium = false;
    }

    const userRole = dbUser?.role || (isSuperadmin ? 'superadmin' : 'user');
    const userPerms: string[] = dbUser?.adminPermissions || [];
    const userBatches: string[] = dbUser?.allowedBatches || [];
    const courseBatches = userBatches.filter(isCourseBatch);
    const hasCourseAccess = isSuperadmin || userRole === 'superadmin' || userRole === 'admin' || userPerms.includes('access_courses') || userPerms.includes('*') || courseBatches.length > 0;

    return NextResponse.json({
      success: true,
      user: {
        id: dbUser?._id?.toString() || '',
        name: dbUser?.name || sessionUser.name,
        email: cleanEmail,
        image: dbUser?.image || sessionUser.image,
        role: userRole,
        adminPermissions: userPerms,
        allowedBatches: userBatches,
        isPremium,
        hasCourseAccess,
        premiumExpiresAt: premiumExpiresAt ? new Date(premiumExpiresAt).toISOString() : null,
        premiumPlan,
        totalScore: dbUser?.totalScore || 0,
        testsCompleted: dbUser?.testsCompleted || 0,
        averageAccuracy: dbUser?.averageAccuracy || 0,
        createdAt: dbUser?.createdAt ? new Date(dbUser.createdAt).toISOString() : new Date().toISOString(),
        rank: userRank,
      },
      recentAttempts: attempts.map((a) => ({
        id: a._id.toString(),
        quizId: a.quizId,
        quizTitle: a.quizTitle,
        score: a.score,
        maxScore: a.maxScore,
        accuracy: a.accuracy,
        isFirstAttempt: a.isFirstAttempt,
        timestamp: a.timestamp,
        createdAt: new Date(a.createdAt).toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch profile' }, { status: 500 });
  }
}
