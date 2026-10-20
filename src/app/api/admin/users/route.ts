import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyAdminPermission, SUPERADMIN_EMAIL } from '@/lib/adminAuth';
import { User } from '@/models/User';
import { Attempt } from '@/models/Attempt';
import { UserSession } from '@/models/UserSession';
import { UserActivityLog } from '@/models/UserActivityLog';
import { PreApprovedEmail } from '@/models/PreApprovedEmail';
import { RedeemCode } from '@/models/RedeemCode';
import { LaunchEvent } from '@/models/LaunchEvent';
import { Report } from '@/models/Report';
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

    if (action === 'delete_user') {
      if (cleanTarget === SUPERADMIN_EMAIL || targetUser.role === 'superadmin') {
        return NextResponse.json({ success: false, error: 'Cannot delete Superadmin account' }, { status: 400 });
      }

      // Deleting admin requires Superadmin privileges
      if (targetUser.role === 'admin' && !adminAuth.isSuperadmin) {
        return NextResponse.json({ success: false, error: 'Only Superadmin can delete Admin accounts' }, { status: 403 });
      }

      try {
        // 1. Mark active sessions terminated immediately to kick user out and delete session documents
        await UserSession.updateMany(
          { userEmail: cleanTarget },
          { $set: { terminated: true } }
        ).catch(e => console.error('Error terminating sessions:', e));
        await UserSession.deleteMany({ userEmail: cleanTarget }).catch(e => console.error('Error deleting sessions:', e));

        // 2. Delete all test attempts and scores
        await Attempt.deleteMany({
          $or: [
            { userEmail: cleanTarget },
            { userId: targetUser._id.toString() },
          ],
        }).catch(e => console.error('Error deleting attempts:', e));

        // 3. Delete user activity tracking logs
        await UserActivityLog.deleteMany({ userEmail: cleanTarget }).catch(e => console.error('Error deleting activity logs:', e));

        // 4. Delete preapproved email records
        await PreApprovedEmail.deleteMany({ email: cleanTarget }).catch(e => console.error('Error deleting preapproved emails:', e));

        // 5. Remove usage history from RedeemCode & LaunchEvent
        await RedeemCode.updateMany(
          { 'usedBy.userEmail': cleanTarget },
          { $pull: { usedBy: { userEmail: cleanTarget } } }
        ).catch(e => console.error('Error updating RedeemCode:', e));
        await LaunchEvent.updateMany(
          { 'claimedUsers.userEmail': cleanTarget },
          { $pull: { claimedUsers: { userEmail: cleanTarget } } }
        ).catch(e => console.error('Error updating LaunchEvent:', e));

        // 6. Delete reports submitted by user
        await Report.deleteMany({ userEmail: cleanTarget }).catch(e => console.error('Error deleting reports:', e));

        // 7. Delete the user document completely
        await User.findOneAndDelete({ email: cleanTarget });

        // 8. Invalidate courses cache
        invalidateUserCourseCache(cleanTarget);

        return NextResponse.json({
          success: true,
          message: `User ${targetUser.email} and all associated data (tests, scores, sessions, premium) have been permanently deleted!`,
          deletedEmail: cleanTarget,
        });
      } catch (err) {
        console.error('Error in delete_user process:', err);
        return NextResponse.json({ success: false, error: 'Failed to completely delete user data' }, { status: 500 });
      }
    }

    if (action === 'grant_demo') {
      const minutes = parseInt(demoDurationMinutes) || 15;
      const now = new Date();
      const isSelf = cleanTarget === sessionUser?.email?.toLowerCase().trim();
      const isCurrentlyOnline = isSelf || (targetUser.lastActiveAt && (now.getTime() - new Date(targetUser.lastActiveAt).getTime() < 5 * 60 * 1000));

      if (isCurrentlyOnline) {
        // User is online right now — activate demo timer immediately
        const expiresAt = new Date(now.getTime() + minutes * 60 * 1000);
        targetUser.isPremium = true;
        targetUser.premiumExpiresAt = expiresAt;
        targetUser.premiumPlan = `${minutes}m_demo`;
        targetUser.allowedBatches = Array.from(new Set([...(targetUser.allowedBatches || []), 'SigmaX']));
        targetUser.hasCourseAccess = true;
        targetUser.hasHadDemoOrPremium = true;
        targetUser.grantedBy = sessionUser!.email.toLowerCase().trim();
        await targetUser.save();
        invalidateUserCourseCache(cleanTarget);

        return NextResponse.json({
          success: true,
          message: `${minutes}m Demo granted & activated immediately for ${targetUser.email} (Expires at ${expiresAt.toLocaleTimeString()})`,
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
      } else {
        // User is offline — queue pending demo so timer only starts when they come online
        targetUser.isPremium = false;
        targetUser.premiumExpiresAt = null;
        targetUser.premiumPlan = `pending_demo:${minutes}m`;
        targetUser.hasHadDemoOrPremium = true;
        targetUser.grantedBy = sessionUser!.email.toLowerCase().trim();
        await targetUser.save();

        return NextResponse.json({
          success: true,
          message: `${minutes}m Demo granted! Timer will automatically start when ${targetUser.email} comes online.`,
          user: {
            id: targetUser._id.toString(),
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role,
            adminPermissions: targetUser.adminPermissions,
            allowedBatches: targetUser.allowedBatches,
            isPremium: false,
            premiumExpiresAt: null,
            premiumPlan: targetUser.premiumPlan,
          }
        });
      }
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
        // When explicitly revoking premium, also empty allowedBatches if not explicitly given
        if (!Array.isArray(allowedBatches)) {
          targetUser.allowedBatches = [];
        }
      }
    }

    const hasAdminCoursePerm = targetUser.adminPermissions?.includes('access_courses') || targetUser.adminPermissions?.includes('*');
    const hasCourseBatches = Array.isArray(targetUser.allowedBatches) && targetUser.allowedBatches.some((b: string) => isCourseBatch(b));

    // Ensure hasCourseAccess in DB is strictly derived without default lifetime bypass
    targetUser.hasCourseAccess = Boolean(targetUser.isPremium || hasAdminCoursePerm || hasCourseBatches);

    // If regular user or admin has revoked premium and has no course batches and no course perms:
    if (!targetUser.isPremium && !hasAdminCoursePerm && !hasCourseBatches && (!targetUser.allowedBatches || targetUser.allowedBatches.length === 0)) {
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
