import { AuthUser as SessionUser } from '@/lib/authContext';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { isCourseSlugAllowed, isCourseBatch } from '@/lib/batchAccess';
import { SUPERADMIN_EMAIL } from '@/lib/adminAuth';

export interface CachedCourseUser {
  role?: string;
  adminPermissions?: string[];
  allowedBatches?: string[];
  premiumPlan?: string;
  isPremium?: boolean;
  premiumExpiresAt?: Date | string | null;
  timestamp: number;
}

const userCourseCache = new Map<string, CachedCourseUser>();

export async function getCachedUserDoc(email: string): Promise<CachedCourseUser | null> {
  const cached = userCourseCache.get(email);
  if (cached && Date.now() - cached.timestamp < 30000) {
    return cached;
  }
  try {
    const conn = await connectToDatabase();
    if (conn) {
      const doc = await User.findOne({ email }).select('role adminPermissions allowedBatches premiumPlan isPremium premiumExpiresAt').lean();
      if (doc) {
        const entry: CachedCourseUser = {
          role: doc.role,
          adminPermissions: doc.adminPermissions,
          allowedBatches: doc.allowedBatches,
          premiumPlan: doc.premiumPlan,
          isPremium: doc.isPremium,
          premiumExpiresAt: doc.premiumExpiresAt,
          timestamp: Date.now(),
        };
        userCourseCache.set(email, entry);
        return entry;
      }
    }
  } catch (err) {
    console.error('Error fetching cached user for course auth:', err);
  }
  return null;
}

export function invalidateUserCourseCache(email?: string) {
  if (email) {
    userCourseCache.delete(email.toLowerCase().trim());
  } else {
    userCourseCache.clear();
  }
}

/**
 * Checks if a user has access to the Course section at all.
 * Returns true ONLY if user is superadmin/admin, has access_courses permission, or has >= 1 course batch.
 * If this returns false, accessing any /courses route throws 404.
 */
export async function hasCoursesAccess(sessionUser: SessionUser | null): Promise<boolean> {
  if (!sessionUser) return false;

  const email = sessionUser.email.toLowerCase().trim();
  if (email === SUPERADMIN_EMAIL) return true;

  // Check fast session props first
  if (sessionUser.role === 'superadmin' || sessionUser.role === 'admin') return true;
  if (sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*')) return true;

  let userBatches: string[] = [];
  let isSuper = false;
  let isAdmin = false;
  let hasPerm = false;

  try {
    const userDoc = await getCachedUserDoc(email);
    if (userDoc) {
      isSuper = userDoc.role === 'superadmin';
      isAdmin = userDoc.role === 'admin';
      hasPerm = userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*') || false;

      userBatches = Array.isArray(userDoc.allowedBatches) ? [...userDoc.allowedBatches] : [];
      if (userDoc.premiumPlan && isCourseBatch(userDoc.premiumPlan)) {
        userBatches.push(userDoc.premiumPlan);
      }
    } else {
      isSuper = (sessionUser as any)?.role === 'superadmin';
      isAdmin = (sessionUser as any)?.role === 'admin';
      hasPerm = sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*') || false;
      userBatches = sessionUser.allowedBatches || [];
    }
  } catch (error) {
    console.error('Error verifying courses access:', error);
    isSuper = (sessionUser as any)?.role === 'superadmin';
    isAdmin = (sessionUser as any)?.role === 'admin';
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

  // Fast check from session
  if ((sessionUser as any)?.role === 'superadmin' || (sessionUser as any)?.role === 'admin') return true;
  if (sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*')) return true;

  let userBatches: string[] = [];

  try {
    const userDoc = await getCachedUserDoc(email);
    if (userDoc) {
      if (userDoc.role === 'superadmin' || userDoc.role === 'admin') return true;
      if (userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*')) return true;

      userBatches = Array.isArray(userDoc.allowedBatches) ? [...userDoc.allowedBatches] : [];
      if (userDoc.premiumPlan && isCourseBatch(userDoc.premiumPlan)) {
        userBatches.push(userDoc.premiumPlan);
      }
    } else {
      userBatches = sessionUser.allowedBatches || [];
    }
  } catch (error) {
    console.error('Error checking course slug unlock:', error);
    userBatches = sessionUser.allowedBatches || [];
  }

  const validCourseBatches = userBatches.filter(isCourseBatch);

  if (validCourseBatches.some(b => b.toLowerCase().includes('sigmax') || b === '*')) {
    return true;
  }

  return isCourseSlugAllowed(validCourseBatches, courseSlug);
}

export async function getUnlockedCourseSlugsMap(sessionUser: SessionUser | null): Promise<(slug: string) => boolean> {
  if (!sessionUser) return () => false;

  const email = sessionUser.email.toLowerCase().trim();
  if (email === SUPERADMIN_EMAIL) return () => true;

  // Fast check from session
  if ((sessionUser as any)?.role === 'superadmin' || (sessionUser as any)?.role === 'admin') return () => true;
  if (sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*')) return () => true;

  let userBatches: string[] = [];

  try {
    const userDoc = await getCachedUserDoc(email);
    if (userDoc) {
      if (userDoc.role === 'superadmin' || userDoc.role === 'admin') return () => true;
      if (userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*')) return () => true;

      userBatches = Array.isArray(userDoc.allowedBatches) ? [...userDoc.allowedBatches] : [];
      if (userDoc.premiumPlan && isCourseBatch(userDoc.premiumPlan)) {
        userBatches.push(userDoc.premiumPlan);
      }
    } else {
      userBatches = sessionUser.allowedBatches || [];
    }
  } catch (error) {
    console.error('Error fetching unlocked courses map:', error);
    userBatches = sessionUser.allowedBatches || [];
  }

  const validCourseBatches = userBatches.filter(isCourseBatch);

  if (validCourseBatches.some((b) => b.toLowerCase().includes('sigmax') || b === '*')) {
    return () => true;
  }

  return (slug: string) => isCourseSlugAllowed(validCourseBatches, slug);
}
