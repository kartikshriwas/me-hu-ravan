import { AuthUser as SessionUser } from '@/lib/authContext';
import { connectToDatabase, resetDatabaseConnection } from '@/lib/db';
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
      const doc = await User.findOne({ email })
        .select('role adminPermissions allowedBatches premiumPlan isPremium premiumExpiresAt')
        .lean()
        .maxTimeMS(5000);

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
  } catch (err: any) {
    if (err?.name === 'MongooseServerSelectionError') {
      await resetDatabaseConnection().catch(() => {});
    }
    console.warn('[CoursesAuth] DB lookup fallback to session user:', err?.message || err);
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

export function checkIsDemoExpired(user: any): { isExpired: boolean; minutes: number } {
  if (!user) return { isExpired: false, minutes: 15 };
  const plan = typeof user.premiumPlan === 'string' ? user.premiumPlan : '';
  let minutes = 15;
  const match = plan.match(/(\d+)m/);
  if (match) minutes = parseInt(match[1]);

  if (plan.startsWith('expired_demo:')) {
    return { isExpired: true, minutes };
  }

  const isDemo = plan.includes('demo') || plan.includes('m_demo');
  if (isDemo && user.premiumExpiresAt && new Date(user.premiumExpiresAt).getTime() <= Date.now()) {
    return { isExpired: true, minutes };
  }

  return { isExpired: false, minutes };
}

export async function hasCoursesAccess(sessionUser: SessionUser | null): Promise<boolean> {
  if (!sessionUser) return false;

  const email = sessionUser.email.toLowerCase().trim();

  // If user's temporary pass/demo has expired, immediately revoke courses access
  if (sessionUser.premiumExpiresAt && new Date(sessionUser.premiumExpiresAt) < new Date()) {
    return false;
  }

  const demoStatus = checkIsDemoExpired(sessionUser);
  if (demoStatus.isExpired) {
    return false;
  }

  // Active premium grant
  if (sessionUser.isPremium) return true;

  // Granular admin rights or batch permissions
  if (sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*')) return true;
  if ((sessionUser as any).hasCourseAccess === true) return true;
  if (Array.isArray(sessionUser.allowedBatches) && sessionUser.allowedBatches.some(isCourseBatch)) return true;

  let userBatches: string[] = [];
  let isPrem = false;
  let hasPerm = false;

  try {
    const userDoc = await getCachedUserDoc(email);
    if (userDoc) {
      if (userDoc.premiumExpiresAt && new Date(userDoc.premiumExpiresAt) < new Date()) {
        return false;
      }
      isPrem = Boolean(userDoc.isPremium);
      hasPerm = userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*') || false;

      userBatches = Array.isArray(userDoc.allowedBatches) ? [...userDoc.allowedBatches] : [];
      if (userDoc.premiumPlan && isCourseBatch(userDoc.premiumPlan)) {
        userBatches.push(userDoc.premiumPlan);
      }
    } else {
      isPrem = Boolean(sessionUser.isPremium);
      hasPerm = sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*') || false;
      userBatches = sessionUser.allowedBatches || [];
    }
  } catch (error) {
    console.error('Error verifying courses access:', error);
    isPrem = Boolean(sessionUser.isPremium);
    hasPerm = sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*') || false;
    userBatches = sessionUser.allowedBatches || [];
  }

  if (isPrem || hasPerm) return true;

  const validCourseBatches = userBatches.filter(isCourseBatch);
  return validCourseBatches.length > 0;
}

export async function isCourseSlugUnlocked(sessionUser: SessionUser | null, courseSlug: string): Promise<boolean> {
  if (!sessionUser || !courseSlug) return false;

  const email = sessionUser.email.toLowerCase().trim();

  // If user's demo or temporary access has expired, block unlock
  if (sessionUser.premiumExpiresAt && new Date(sessionUser.premiumExpiresAt) < new Date()) {
    return false;
  }
  if (checkIsDemoExpired(sessionUser).isExpired) {
    return false;
  }

  if (sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*')) return true;

  let userBatches: string[] = [];
  let isPrem = Boolean(sessionUser.isPremium);

  try {
    const userDoc = await getCachedUserDoc(email);
    if (userDoc) {
      if (userDoc.premiumExpiresAt && new Date(userDoc.premiumExpiresAt) < new Date()) {
        return false;
      }
      if (checkIsDemoExpired(userDoc).isExpired) {
        return false;
      }
      if (userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*')) return true;

      isPrem = Boolean(userDoc.isPremium);
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

  // Active premium with no batch restrictions or all-batch access unlocks everything
  if (isPrem && (userBatches.length === 0 || userBatches.includes('*'))) {
    return true;
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

  // If user's demo or temporary access has expired, block unlock
  if (sessionUser.premiumExpiresAt && new Date(sessionUser.premiumExpiresAt) < new Date()) {
    return () => false;
  }
  if (checkIsDemoExpired(sessionUser).isExpired) {
    return () => false;
  }

  if (sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*')) return () => true;

  let userBatches: string[] = [];
  let isPrem = Boolean(sessionUser.isPremium);

  try {
    const userDoc = await getCachedUserDoc(email);
    if (userDoc) {
      if (userDoc.premiumExpiresAt && new Date(userDoc.premiumExpiresAt) < new Date()) {
        return () => false;
      }
      if (checkIsDemoExpired(userDoc).isExpired) {
        return () => false;
      }
      if (userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*')) return () => true;

      isPrem = Boolean(userDoc.isPremium);
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

  // Active premium with no batch restrictions or all-batch access unlocks everything
  if (isPrem && (userBatches.length === 0 || userBatches.includes('*'))) {
    return () => true;
  }

  const validCourseBatches = userBatches.filter(isCourseBatch);

  if (validCourseBatches.some((b) => b.toLowerCase().includes('sigmax') || b === '*')) {
    return () => true;
  }

  return (slug: string) => isCourseSlugAllowed(validCourseBatches, slug);
}
