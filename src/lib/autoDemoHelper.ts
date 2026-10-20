import { User } from '@/models/User';
import { getAutoDemoConfig } from '@/lib/globalSetting';
import { invalidateUserCourseCache } from '@/lib/coursesAuth';
import { checkIsAltAccount } from '@/lib/altDetection';

/**
 * Checks if auto-demo feature is enabled and grants demo access to new emails / users
 * who have NEVER had premium or demo in the past.
 * Returns boolean indicating whether a demo was granted in this operation.
 */
export async function processAutoDemoGrant(dbUser: any, currentIp?: string): Promise<boolean> {
  if (!dbUser || !dbUser.email) return false;

  // Admins & superadmins already have full permissions
  if (dbUser.role === 'superadmin' || dbUser.role === 'admin') return false;

  // 1. If user is already identified as alt account, NEVER grant demo!
  if (dbUser.isAlt) {
    if (!dbUser.hasHadDemoOrPremium) {
      await User.updateOne({ _id: dbUser._id }, { $set: { hasHadDemoOrPremium: true } }).catch(() => {});
    }
    return false;
  }

  // 2. Fast check: If user has EVER had premium or demo in the past, return immediately (zero DB queries)
  const hasHadHistory =
    Boolean(dbUser.hasHadDemoOrPremium) ||
    Boolean(dbUser.isPremium) ||
    (typeof dbUser.premiumPlan === 'string' && dbUser.premiumPlan !== 'free' && dbUser.premiumPlan.trim() !== '') ||
    (Array.isArray(dbUser.allowedBatches) && dbUser.allowedBatches.length > 0);

  if (hasHadHistory) {
    if (!dbUser.hasHadDemoOrPremium) {
      await User.updateOne({ _id: dbUser._id }, { $set: { hasHadDemoOrPremium: true } }).catch(() => {});
    }
    return false;
  }

  // 3. Check if auto-demo feature is enabled by admin
  const { autoDemoEnabled, autoDemoDurationMinutes } = await getAutoDemoConfig();
  if (!autoDemoEnabled) return false;

  // 4. Multi-factor alt account check: Email alias, Device ID, IP collision
  const altResult = await checkIsAltAccount({
    email: dbUser.email,
    clientIp: currentIp || dbUser.lastIp,
  });

  if (altResult.isAlt) {
    // Mark as alt account silently without alerting the user
    await User.updateOne(
      { _id: dbUser._id },
      {
        $set: {
          isAlt: true,
          altOfEmail: altResult.altOfEmail,
          altReason: altResult.reason,
          hasHadDemoOrPremium: true,
          ...(currentIp ? { lastIp: currentIp } : {}),
        },
        ...(currentIp ? { $addToSet: { pastIps: currentIp } } : {}),
      }
    ).catch(() => {});
    return false;
  }

  // 3. Eligible! Grant demo now with duration set by admin
  const now = new Date();
  const minutes = Math.max(1, autoDemoDurationMinutes || 15);
  const expiresAt = new Date(now.getTime() + minutes * 60 * 1000);
  const allowedBatches = Array.from(new Set([...(dbUser.allowedBatches || []), 'SigmaX']));

  await User.updateOne(
    { _id: dbUser._id },
    {
      $set: {
        isPremium: true,
        premiumExpiresAt: expiresAt,
        premiumPlan: `${minutes}m_demo`,
        allowedBatches: allowedBatches,
        hasCourseAccess: true,
        grantedBy: 'auto_demo',
        hasHadDemoOrPremium: true,
        lastActiveAt: now,
      },
    }
  );

  invalidateUserCourseCache(dbUser.email);
  return true;
}
