import { AuthUser as SessionUser } from '@/lib/authContext';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { isCourseSlugAllowed, isCourseBatch } from '@/lib/batchAccess';
import { SUPERADMIN_EMAIL } from '@/lib/adminAuth';

/**
 * Checks if a user has access to the Course section at all.
 * Returns true ONLY if user is superadmin/admin, has access_courses permission, or has >= 1 course batch.
 * If this returns false, accessing any /courses route throws 404.
 */
export async function hasCoursesAccess(sessionUser: SessionUser | null): Promise<boolean> {
  if (!sessionUser) return false;

  const email = sessionUser.email.toLowerCase().trim();
  if (email === SUPERADMIN_EMAIL) return true;

  let userBatches: string[] = [];
  let isSuper = false;
  let isAdmin = false;
  let hasPerm = false;

  try {
    const conn = await connectToDatabase();
    if (conn) {
      const userDoc = await User.findOne({ email }).select('role adminPermissions allowedBatches premiumPlan').lean();
      if (userDoc) {
        isSuper = userDoc.role === 'superadmin';
        isAdmin = userDoc.role === 'admin';
        hasPerm = userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*') || false;

        userBatches = Array.isArray(userDoc.allowedBatches) ? [...userDoc.allowedBatches] : [];
        if (userDoc.premiumPlan && isCourseBatch(userDoc.premiumPlan)) {
          userBatches.push(userDoc.premiumPlan);
        }
      } else {
        // Fallback for brand new sessionUser before DB sync
        isSuper = sessionUser.role === 'superadmin';
        isAdmin = sessionUser.role === 'admin';
        hasPerm = sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*') || false;
        userBatches = sessionUser.allowedBatches || [];
      }
    }
  } catch (error) {
    console.error('Error verifying courses access:', error);
    isSuper = sessionUser.role === 'superadmin';
    isAdmin = sessionUser.role === 'admin';
    hasPerm = sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*') || false;
    userBatches = sessionUser.allowedBatches || [];
  }

  if (isSuper || isAdmin || hasPerm) return true;

  const validCourseBatches = userBatches.filter(isCourseBatch);
  return validCourseBatches.length > 0;
}

export async function isCourseSlugUnlocked(sessionUser: SessionUser | null, courseSlug: string): Promise<boolean> {
  if (!sessionUser || !courseSlug) return false;

  const email = sessionUser.email.toLowerCase().trim();
  if (email === SUPERADMIN_EMAIL) return true;

  let userBatches: string[] = [];

  try {
    const conn = await connectToDatabase();
    if (conn) {
      const userDoc = await User.findOne({ email }).select('role adminPermissions allowedBatches premiumPlan').lean();
      if (userDoc) {
        if (userDoc.role === 'superadmin' || userDoc.role === 'admin') return true;
        if (userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*')) return true;

        userBatches = Array.isArray(userDoc.allowedBatches) ? [...userDoc.allowedBatches] : [];
        if (userDoc.premiumPlan && isCourseBatch(userDoc.premiumPlan)) {
          userBatches.push(userDoc.premiumPlan);
        }
      } else {
        if (sessionUser.role === 'superadmin' || sessionUser.role === 'admin') return true;
        if (sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*')) return true;
        userBatches = sessionUser.allowedBatches || [];
      }
    }
  } catch (error) {
    console.error('Error checking course slug unlock:', error);
    if (sessionUser.role === 'superadmin' || sessionUser.role === 'admin') return true;
    if (sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*')) return true;
    userBatches = sessionUser.allowedBatches || [];
  }

  const validCourseBatches = userBatches.filter(isCourseBatch);

  if (validCourseBatches.some(b => b.toLowerCase().includes('sigmax') || b === '*')) {
    return true;
  }

  return isCourseSlugAllowed(validCourseBatches, courseSlug);
}
