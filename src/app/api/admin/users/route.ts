import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyAdminPermission, SUPERADMIN_EMAIL } from '@/lib/adminAuth';
import { User } from '@/models/User';
import { invalidateUserCourseCache } from '@/lib/coursesAuth';
import { isCourseBatch } from '@/lib/batchAccess';

export async function GET(request: Request) {
  try {
    const session = await auth();
  const sessionUser = session?.user as any;
    const adminAuth = await verifyAdminPermission(sessionUser?.email, 'manage_users');
    if (!adminAuth.isAuthorized) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.statusCode || 403 });
    }

    const users = await User.find()
      .select('_id name email image role adminPermissions allowedBatches isPremium premiumExpiresAt premiumPlan totalScore testsCompleted createdAt')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return NextResponse.json({
      success: true,
      users: users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        image: u.image,
        role: u.role || (u.email === SUPERADMIN_EMAIL ? 'superadmin' : 'user'),
        adminPermissions: u.adminPermissions || [],
        allowedBatches: u.allowedBatches || [],
        isPremium: !!u.isPremium,
        premiumExpiresAt: u.premiumExpiresAt ? new Date(u.premiumExpiresAt).toISOString() : null,
        premiumPlan: u.premiumPlan || 'free',
        totalScore: u.totalScore || 0,
        testsCompleted: u.testsCompleted || 0,
        createdAt: new Date(u.createdAt).toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
  const sessionUser = session?.user as any;
    const adminAuth = await verifyAdminPermission(sessionUser?.email, 'manage_users');
    if (!adminAuth.isAuthorized) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.statusCode || 403 });
    }

    const body = await request.json();
    const { action, targetEmail, role, adminPermissions, allowedBatches, isPremium, durationDays, demoDurationMinutes } = body;

    if (!targetEmail || typeof targetEmail !== 'string') {
      return NextResponse.json({ success: false, error: 'Target email is required' }, { status: 400 });
    }

    const cleanTarget = targetEmail.toLowerCase().trim();

    const targetUser = await User.findOne({ email: cleanTarget });
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (action === 'grant_demo') {
      const minutes = parseInt(demoDurationMinutes) || 15;
      targetUser.isPremium = true;
      targetUser.premiumExpiresAt = new Date(Date.now() + minutes * 60 * 1000);
      targetUser.premiumPlan = `${minutes}m_demo`;
      targetUser.allowedBatches = ['SigmaX'];
      targetUser.hasCourseAccess = true;
      targetUser.grantedBy = sessionUser!.email.toLowerCase().trim();
      await targetUser.save();
      invalidateUserCourseCache(cleanTarget);

      return NextResponse.json({
        success: true,
        message: `${minutes}m Demo granted successfully to ${targetUser.email}`,
        user: {
          id: targetUser._id.toString(),
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          adminPermissions: targetUser.adminPermissions,
          allowedBatches: targetUser.allowedBatches,
          isPremium: targetUser.isPremium,
          premiumExpiresAt: targetUser.premiumExpiresAt.toISOString(),
        }
      });
    }

    // Modifying role or granular permissions requires Superadmin privileges
    const isAssigningAdmin = (role && role !== 'user') || (Array.isArray(adminPermissions) && adminPermissions.length > 0);
    if (isAssigningAdmin && !adminAuth.isSuperadmin) {
      return NextResponse.json({ success: false, error: 'Only Superadmin can assign Admin roles or permissions' }, { status: 403 });
    }

    // Prevent demoting primary superadmin
    if (cleanTarget === SUPERADMIN_EMAIL && role && role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Primary Super Admin role cannot be modified' }, { status: 400 });
    }

    if (role && ['admin', 'user'].includes(role)) {
      targetUser.role = role;
    }

    if (Array.isArray(adminPermissions)) {
      targetUser.adminPermissions = adminPermissions;
    }

    if (Array.isArray(allowedBatches)) {
      targetUser.allowedBatches = allowedBatches;
    }

    if (typeof isPremium === 'boolean') {
      targetUser.isPremium = isPremium;
      if (isPremium) {
        const numDur = parseInt(durationDays) || 365;
        targetUser.premiumExpiresAt = numDur < 3650 ? new Date(Date.now() + numDur * 24 * 60 * 60 * 1000) : null;
        targetUser.premiumPlan = 'admin_role_grant';
        targetUser.grantedBy = sessionUser!.email.toLowerCase().trim();
      } else {
        targetUser.premiumExpiresAt = null;
        targetUser.premiumPlan = 'free';
        targetUser.grantedBy = '';
        // When explicitly revoking premium, also empty allowedBatches if not admin and not explicitly given
        if (targetUser.role !== 'admin' && targetUser.role !== 'superadmin' && !Array.isArray(allowedBatches)) {
          targetUser.allowedBatches = [];
        }
      }
    }

    const isSuperOrAdmin = targetUser.role === 'admin' || targetUser.role === 'superadmin' || cleanTarget === SUPERADMIN_EMAIL;
    const hasAdminCoursePerm = targetUser.adminPermissions?.includes('access_courses') || targetUser.adminPermissions?.includes('*');
    const hasCourseBatches = Array.isArray(targetUser.allowedBatches) && targetUser.allowedBatches.some((b: string) => isCourseBatch(b));

    // Ensure hasCourseAccess in DB is strictly derived
    targetUser.hasCourseAccess = Boolean(isSuperOrAdmin || hasAdminCoursePerm || hasCourseBatches);

    // If regular user has no course batches, no admin role, and their plan was admin grant or demo or batch grant:
    if (!isSuperOrAdmin && !hasAdminCoursePerm && !hasCourseBatches && (!targetUser.allowedBatches || targetUser.allowedBatches.length === 0)) {
      if (targetUser.premiumPlan === 'admin_role_grant' || targetUser.premiumPlan?.includes('demo') || targetUser.premiumPlan?.startsWith('code:')) {
        targetUser.isPremium = false;
        targetUser.premiumExpiresAt = null;
        targetUser.premiumPlan = 'free';
      }
    }

    await targetUser.save();
    invalidateUserCourseCache(cleanTarget);

    return NextResponse.json({
      success: true,
      message: `User ${targetUser.email} permissions updated successfully!`,
      user: {
        id: targetUser._id.toString(),
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        adminPermissions: targetUser.adminPermissions,
        allowedBatches: targetUser.allowedBatches,
        isPremium: targetUser.isPremium,
      },
    });
  } catch (error) {
    console.error('Error updating user role/permissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}
