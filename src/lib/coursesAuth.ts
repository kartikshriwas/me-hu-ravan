import { SessionUser } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { isPlatformGlobalFree } from '@/lib/globalSetting';
import { isCourseSlugAllowed } from '@/lib/batchAccess';

const SUPERADMIN_EMAIL = 'fykartik@gmail.com';

export async function hasCoursesAccess(sessionUser: SessionUser | null, courseSlug?: string): Promise<boolean> {
  if (!sessionUser) return false;
  
  const email = sessionUser.email.toLowerCase().trim();
  if (email === SUPERADMIN_EMAIL || sessionUser.role === 'superadmin' || sessionUser.role === 'admin') {
    return true;
  }

  // Fetch full user record to get exact allowedBatches and permissions
  let userBatches: string[] = sessionUser.allowedBatches || [];
  let isSuper = false;
  let isAdmin = false;
  let hasPerm = sessionUser.adminPermissions?.includes('access_courses') || sessionUser.adminPermissions?.includes('*');

  try {
    const conn = await connectToDatabase();
    if (conn) {
      const userDoc = await User.findOne({ email }).select('role isPremium adminPermissions allowedBatches premiumPlan').lean();
      if (userDoc) {
        isSuper = userDoc.role === 'superadmin';
        isAdmin = userDoc.role === 'admin';
        hasPerm = userDoc.adminPermissions?.includes('access_courses') || userDoc.adminPermissions?.includes('*') || false;
        
        if (Array.isArray(userDoc.allowedBatches)) {
          userBatches = Array.from(new Set([...userBatches, ...userDoc.allowedBatches]));
        }
        if (userDoc.premiumPlan) {
          userBatches.push(userDoc.premiumPlan);
        }
      }
    }
  } catch (error) {
    console.error('Error verifying courses access:', error);
  }

  if (isSuper || isAdmin || hasPerm) return true;

  // Filter out Quiz-Only batches (quiz access only, no video courses)
  const courseBatches = userBatches.filter(b => {
    const norm = b.toLowerCase();
    return !norm.includes('quiz');
  });

  if (courseBatches.length === 0) {
    return false;
  }

  // General catalog access check (when no specific courseSlug requested)
  if (!courseSlug) {
    return true;
  }

  // Specific course slug check
  // If user has SigmaX or '*', grant access to all courses
  if (courseBatches.some(b => b.toLowerCase().includes('sigmax') || b === '*')) {
    return true;
  }

  // Otherwise check if specific course slug is authorized for the user's batches
  return isCourseSlugAllowed(courseBatches, courseSlug);
}
