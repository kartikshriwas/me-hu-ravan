import { User } from '@/models/User';
import { invalidateUserCourseCache } from '@/lib/coursesAuth';

/**
 * Checks if a user has a queued pending demo ('pending_demo:Xm').
 * If found, activates the demo countdown starting right now when the user comes online.
 */
export async function processPendingDemoActivation(dbUser: any): Promise<boolean> {
  if (!dbUser || !dbUser.email || !dbUser.premiumPlan || typeof dbUser.premiumPlan !== 'string' || !dbUser.premiumPlan.startsWith('pending_demo:')) {
    return false;
  }

  const minMatch = dbUser.premiumPlan.match(/pending_demo:(\d+)m/);
  const minutes = minMatch ? parseInt(minMatch[1]) : 15;
  const now = new Date();
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
        lastActiveAt: now,
      }
    }
  );

  invalidateUserCourseCache(dbUser.email);
  return true;
}
