import { User } from '@/models/User';
import { getAutoDemoConfig } from '@/lib/globalSetting';
import { invalidateUserCourseCache } from '@/lib/coursesAuth';

/**
 * Checks if auto-demo feature is enabled and grants demo access to new emails / users
 * who have NEVER had premium or demo in the past.
 * Returns boolean indicating whether a demo was granted in this operation.
 */
export async function processAutoDemoGrant(dbUser: any): Promise<boolean> {
  if (!dbUser || !dbUser.email) return false;

  // Admins & superadmins already have full permissions
  if (dbUser.role === 'superadmin' || dbUser.role === 'admin') return false;

  // 1. Check if auto-demo feature is enabled by admin
  const { autoDemoEnabled, autoDemoDurationMinutes } = await getAutoDemoConfig();
  if (!autoDemoEnabled) return false;

  // 2. Check if user has EVER had premium or demo in the past
  const hasHadHistory =
    Boolean(dbUser.hasHadDemoOrPremium) ||
    Boolean(dbUser.isPremium) ||
    (typeof dbUser.premiumPlan === 'string' && dbUser.premiumPlan !== 'free' && dbUser.premiumPlan.trim() !== '') ||
    (Array.isArray(dbUser.allowedBatches) && dbUser.allowedBatches.length > 0);

  if (hasHadHistory) {
    // If they had history but hasHadDemoOrPremium wasn't flagged yet, flag it now for clean state
    if (!dbUser.hasHadDemoOrPremium) {
      await User.updateOne({ _id: dbUser._id }, { $set: { hasHadDemoOrPremium: true } }).catch(() => {});
    }
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
