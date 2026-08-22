import { SessionUser } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { isPlatformGlobalFree } from '@/lib/globalSetting';

const SUPERADMIN_EMAIL = 'fykartik@gmail.com';

export async function hasCoursesAccess(sessionUser: SessionUser | null, courseSlug?: string): Promise<boolean> {
  if (!sessionUser) return false;
  
  const email = sessionUser.email.toLowerCase().trim();
  if (email === SUPERADMIN_EMAIL) return true;

  try {
    const conn = await connectToDatabase();
    if (!conn) return false;

    const userDoc = await User.findOne({ email }).select('role isPremium premiumPlan adminPermissions grantedCourses premiumExpiresAt').lean();
    if (!userDoc) return false;

    // Check expiration if premium
    let isPrem = !!userDoc.isPremium;
    if (isPrem && userDoc.premiumExpiresAt && new Date(userDoc.premiumExpiresAt) < new Date()) {
      isPrem = false;
    }

    const isSuper = userDoc.role === 'superadmin' || email === SUPERADMIN_EMAIL;
    const isAdmin = userDoc.role === 'admin';
    const hasPerm = userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*');

    // Superadmin, Admin, or user with explicit access_courses permission
    if (isSuper || isAdmin || hasPerm) return true;

    // Platform global free pass
    const globalFreeConfig = await isPlatformGlobalFree();
    if (globalFreeConfig.isGlobalFree) return true;

    // Check specific granted courses list
    const granted: string[] = userDoc.grantedCourses || [];
    if (granted.includes('*') || granted.includes('all')) return true;
    if (courseSlug) {
      const targetSlug = courseSlug.toLowerCase().trim();
      if (granted.some(c => c.toLowerCase().trim() === targetSlug)) return true;
    }

    // Full Premium member (excluding 'quizzes_only' plan)
    if (isPrem && userDoc.premiumPlan !== 'quizzes_only') return true;

    return false;
  } catch (error) {
    console.error('Error verifying courses access:', error);
    return false;
  }
}
