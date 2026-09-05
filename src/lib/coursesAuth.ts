import { SessionUser } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { isCourseSlugAllowed, isCourseBatch } from '@/lib/batchAccess';

const SUPERADMIN_EMAIL = 'fykartik@gmail.com';

/**
 * Checks if a user has access to the Course section at all.
 * Returns true ONLY if user is superadmin/admin, has access_courses permission, or has >= 1 course batch.
 * If this returns false, accessing any /courses route throws 404.
 */
export async function hasCoursesAccess(sessionUser: SessionUser | null): Promise<boolean> {
  if (!sessionUser) return false;

  const email = sessionUser.email.toLowerCase().trim();
  if (email === SUPERADMIN_EMAIL || sessionUser.role === 'superadmin' || sessionUser.role === 'admin') {
    return true;
  }

  let userBatches: string[] = sessionUser.allowedBatches || [];
  let isSuper = false;
  let isAdmin = false;
  let hasPerm = sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*');

  try {
    const conn = await connectToDatabase();
    if (conn) {
      const userDoc = await User.findOne({ email }).select('role adminPermissions allowedBatches premiumPlan').lean();
      if (userDoc) {
        isSuper = userDoc.role === 'superadmin';
        isAdmin = userDoc.role === 'admin';
        hasPerm = userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*') || false;

        if (Array.isArray(userDoc.allowedBatches)) {
          userBatches = Array.from(new Set([...userBatches, ...userDoc.allowedBatches]));
        }
        if (userDoc.premiumPlan && isCourseBatch(userDoc.premiumPlan)) {
          userBatches.push(userDoc.premiumPlan);
        }
      }
    }
  } catch (error) {
    console.error('Error verifying courses access:', error);
  }

  if (isSuper || isAdmin || hasPerm) return true;

  const validCourseBatches = userBatches.filter(isCourseBatch);
  return validCourseBatches.length > 0;
}

/**
 * Checks if a specific course slug is unlocked for video playback for a user with course access.
 * Returns true if the user's batch unlocks this course.
 * Returns false if the course curriculum is viewable but video playback is locked.
 */
export async function isCourseSlugUnlocked(sessionUser: SessionUser | null, courseSlug: string): Promise<boolean> {
  if (!sessionUser || !courseSlug) return false;

  const email = sessionUser.email.toLowerCase().trim();
  if (email === SUPERADMIN_EMAIL || sessionUser.role === 'superadmin' || sessionUser.role === 'admin') {
    return true;
  }

  let userBatches: string[] = sessionUser.allowedBatches || [];

  try {
    const conn = await connectToDatabase();
    if (conn) {
      const userDoc = await User.findOne({ email }).select('role adminPermissions allowedBatches premiumPlan').lean();
      if (userDoc) {
        if (userDoc.role === 'superadmin' || userDoc.role === 'admin') return true;
        if (userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*')) return true;

        if (Array.isArray(userDoc.allowedBatches)) {
          userBatches = Array.from(new Set([...userBatches, ...userDoc.allowedBatches]));
        }
        if (userDoc.premiumPlan && isCourseBatch(userDoc.premiumPlan)) {
          userBatches.push(userDoc.premiumPlan);
        }
      }
    }
  } catch (error) {
    console.error('Error checking course slug unlock:', error);
  }

  const validCourseBatches = userBatches.filter(isCourseBatch);

  if (validCourseBatches.some(b => b.toLowerCase().includes('sigmax') || b === '*')) {
    return true;
  }

  return isCourseSlugAllowed(validCourseBatches, courseSlug);
}
