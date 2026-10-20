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

  // 1. Explicitly flagged as expired demo
  if (plan.startsWith('expired_demo:') || plan === 'expired') {
    return { isExpired: true, minutes };
  }

  // 2. User has a demo plan and the expiration timestamp has passed
  const isDemo = plan.includes('demo') || plan.includes('m_demo');
  if (isDemo && user.premiumExpiresAt && new Date(user.premiumExpiresAt).getTime() <= Date.now()) {
    return { isExpired: true, minutes };
  }

  // 3. Admin permissions (explicit course access)
  if (user.adminPermissions?.includes('access_courses') || user.adminPermissions?.includes('*')) {
    return { isExpired: false, minutes };
  }

  // 4. Permanent course batch holders (only if NOT on an active demo or expired plan)
  if (!isDemo && !plan.startsWith('expired')) {
    if (Array.isArray(user.allowedBatches) && user.allowedBatches.some((b: string) => isCourseBatch(b))) {
      return { isExpired: false, minutes };
    }
    if (user.premiumPlan && isCourseBatch(user.premiumPlan)) {
      return { isExpired: false, minutes };
    }
  }

  return { isExpired: false, minutes };
}

export async function hasCoursesAccess(sessionUser: SessionUser | null): Promise<boolean> {
  if (!sessionUser) return false;

  const email = sessionUser.email.toLowerCase().trim();

  // 1. Check demo expiration first
  const demoStatus = checkIsDemoExpired(sessionUser);
  if (demoStatus.isExpired) {
    return false;
  }

  // 2. Check DB doc to verify real-time status
  let userBatches: string[] = [];
  let hasPerm = false;
  let isDemoActive = false;

  try {
    const userDoc = await getCachedUserDoc(email);
    if (userDoc) {
      if (checkIsDemoExpired(userDoc).isExpired) {
        return false;
      }
      hasPerm = userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*') || false;
      const plan = typeof userDoc.premiumPlan === 'string' ? userDoc.premiumPlan : '';
      const isDemo = plan.includes('demo') || plan.includes('m_demo');

      if (isDemo && userDoc.premiumExpiresAt && new Date(userDoc.premiumExpiresAt).getTime() > Date.now()) {
        isDemoActive = true;
      }

      if (!isDemo && !plan.startsWith('expired')) {
        userBatches = Array.isArray(userDoc.allowedBatches) ? [...userDoc.allowedBatches] : [];
        if (userDoc.premiumPlan && isCourseBatch(userDoc.premiumPlan)) {
          userBatches.push(userDoc.premiumPlan);
        }
      }
    } else {
      hasPerm = sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*') || false;
      const plan = typeof sessionUser.premiumPlan === 'string' ? sessionUser.premiumPlan : '';
      const isDemo = plan.includes('demo') || plan.includes('m_demo');
      if (isDemo && sessionUser.premiumExpiresAt && new Date(sessionUser.premiumExpiresAt).getTime() > Date.now()) {
        isDemoActive = true;
      }
      if (!isDemo && !plan.startsWith('expired')) {
        userBatches = sessionUser.allowedBatches || [];
      }
    }
  } catch (error) {
    console.error('Error verifying courses access:', error);
  }

  if (hasPerm || isDemoActive) return true;

  const validCourseBatches = userBatches.filter(isCourseBatch);
  return validCourseBatches.length > 0;
}

export async function isCourseSlugUnlocked(sessionUser: SessionUser | null, courseSlug: string): Promise<boolean> {
  if (!sessionUser || !courseSlug) return false;

  if (sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*')) return true;

  if (checkIsDemoExpired(sessionUser).isExpired) {
    return false;
  }

  const email = sessionUser.email.toLowerCase().trim();
  let userBatches: string[] = [];
  let hasPerm = false;

  try {
    const userDoc = await getCachedUserDoc(email);
    if (userDoc) {
      if (checkIsDemoExpired(userDoc).isExpired) {
        return false;
      }
      if (userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*')) return true;

      hasPerm = userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*') || false;
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
  if (validCourseBatches.length === 0 && !hasPerm) {
    // If user is on an active demo
    const plan = typeof sessionUser.premiumPlan === 'string' ? sessionUser.premiumPlan : '';
    if ((plan.includes('demo') || plan.includes('m_demo')) && sessionUser.premiumExpiresAt && new Date(sessionUser.premiumExpiresAt).getTime() > Date.now()) {
      return true;
    }
    return false;
  }

  if (hasPerm || validCourseBatches.some(b => b.toLowerCase().includes('sigmax') || b === '*')) {
    return true;
  }

  return isCourseSlugAllowed(validCourseBatches, courseSlug);
}

export async function getUnlockedCourseSlugsMap(sessionUser: SessionUser | null): Promise<(slug: string) => boolean> {
  if (!sessionUser) return () => false;

  if (sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*')) return () => true;

  if (checkIsDemoExpired(sessionUser).isExpired) {
    return () => false;
  }

  const email = sessionUser.email.toLowerCase().trim();
  let userBatches: string[] = [];
  let hasPerm = false;

  try {
    const userDoc = await getCachedUserDoc(email);
    if (userDoc) {
      if (checkIsDemoExpired(userDoc).isExpired) {
        return () => false;
      }
      if (userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*')) return () => true;

      hasPerm = userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*') || false;
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
  if (validCourseBatches.length === 0 && !hasPerm) {
    const plan = typeof sessionUser.premiumPlan === 'string' ? sessionUser.premiumPlan : '';
    if ((plan.includes('demo') || plan.includes('m_demo')) && sessionUser.premiumExpiresAt && new Date(sessionUser.premiumExpiresAt).getTime() > Date.now()) {
      return () => true;
    }
    return () => false;
  }

  if (hasPerm || validCourseBatches.some((b) => b.toLowerCase().includes('sigmax') || b === '*')) {
    return () => true;
  }

  return (slug: string) => isCourseSlugAllowed(validCourseBatches, slug);
}
