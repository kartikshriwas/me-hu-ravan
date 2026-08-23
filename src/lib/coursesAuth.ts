import { SessionUser } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';

const SUPERADMIN_EMAIL = 'fykartik@gmail.com';

export async function hasCoursesAccess(sessionUser: SessionUser | null): Promise<boolean> {
  if (!sessionUser) return false;
  
  const email = sessionUser.email.toLowerCase().trim();
  if (email === SUPERADMIN_EMAIL) return true;

  // Fast-path: Check session claims first to avoid unnecessary DB calls
  if (
    sessionUser.role === 'superadmin' || 
    sessionUser.role === 'admin' || 
    sessionUser.isPremium || 
    sessionUser.adminPermissions?.includes('access_courses')
  ) {
    return true;
  }

  try {
    const conn = await connectToDatabase();
    if (!conn) return false;

    const userDoc = await User.findOne({ email }).select('role isPremium adminPermissions').lean();
    if (!userDoc) return false;

    // Allowed if superadmin, admin, premium user, or has View Courses permission
    const isSuper = userDoc.role === 'superadmin' || email === SUPERADMIN_EMAIL;
    const isAdmin = userDoc.role === 'admin';
    const isPrem = !!userDoc.isPremium;
    const hasPerm = userDoc.adminPermissions?.includes('access_courses');

    return isSuper || isAdmin || isPrem || !!hasPerm;
  } catch (error) {
    console.error('Error verifying courses access:', error);
    return false;
  }
}
