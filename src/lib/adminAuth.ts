import { User } from '@/models/User';
import { connectToDatabase } from '@/lib/db';

export const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || '').toLowerCase().trim();

export type AdminPermission =
  | 'manage_codes'
  | 'manage_events'
  | 'manage_emails'
  | 'manage_users'
  | 'manage_global_free'
  | 'access_courses';

export interface AdminAuthResult {
  isAuthorized: boolean;
  isSuperadmin: boolean;
  user: any | null;
  error?: string;
  statusCode?: number;
}

export async function verifyAdminPermission(
  sessionEmail: string | null | undefined,
  requiredPermission?: AdminPermission
): Promise<AdminAuthResult> {
  if (!sessionEmail) {
    return { isAuthorized: false, isSuperadmin: false, user: null, error: 'Unauthorized', statusCode: 401 };
  }

  const cleanEmail = sessionEmail.toLowerCase().trim();
  const isSuperadmin = cleanEmail === SUPERADMIN_EMAIL;

  const conn = await connectToDatabase();
  if (!conn) {
    return { isAuthorized: false, isSuperadmin, user: null, error: 'Database connection failed', statusCode: 500 };
  }

  const dbUser = await User.findOne({ email: cleanEmail })
    .select('role adminPermissions isPremium email name')
    .lean();

  if (!dbUser) {
    return { isAuthorized: false, isSuperadmin, user: null, error: 'User record not found', statusCode: 404 };
  }

  // Superadmin email or explicit 'superadmin' role has unrestricted access
  if (isSuperadmin || dbUser.role === 'superadmin') {
    return { isAuthorized: true, isSuperadmin: true, user: dbUser };
  }

  // User must have 'admin' role
  if (dbUser.role !== 'admin') {
    return { isAuthorized: false, isSuperadmin: false, user: dbUser, error: 'Admin role required', statusCode: 403 };
  }

  // If a specific granular permission is required, check adminPermissions array
  if (requiredPermission) {
    const userPerms: string[] = dbUser.adminPermissions || [];
    const hasPerm = userPerms.includes(requiredPermission) || userPerms.includes('*');
    if (!hasPerm) {
      return {
        isAuthorized: false,
        isSuperadmin: false,
        user: dbUser,
        error: `Permission '${requiredPermission}' required for this action`,
        statusCode: 403
      };
    }
  }

  return { isAuthorized: true, isSuperadmin: false, user: dbUser };
}
