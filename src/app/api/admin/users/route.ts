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
      .select('_id name email image role adminPermissions allowedBatches isPremium premiumExpiresAt premiumPlan totalScore testsCompleted createdAt isAlt altOfEmail altReason')
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
        isAlt: !!u.isAlt,
        altOfEmail: u.altOfEmail || '',
        altReason: u.altReason || '',
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
        const demoBatches = Array.from(new Set([...(targetUser.allowedBatches || []), 'SigmaX']));

        await User.findOneAndUpdate(
          { _id: targetUser._id },
          {
            $set: {
              isPremium: true,
              premiumExpiresAt: expiresAt,
              premiumPlan: `${minutes}m_demo`,
              allowedBatches: demoBatches,
              hasCourseAccess: true,
              hasHadDemoOrPremium: true,
              grantedBy: sessionUser!.email.toLowerCase().trim(),
            }
          }
        );
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
            allowedBatches: demoBatches,
            isPremium: true,
            premiumExpiresAt: expiresAt.toISOString(),
          }
        });
      } else {
        // User is offline — queue pending demo so timer only starts when they come online
        await User.findOneAndUpdate(
          { _id: targetUser._id },
          {
            $set: {
              isPremium: false,
              premiumExpiresAt: null,
              premiumPlan: `pending_demo:${minutes}m`,
              hasHadDemoOrPremium: true,
              grantedBy: sessionUser!.email.toLowerCase().trim(),
            }
          }
        );

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
      const hasAssignedCourseBatches = allowedBatches.some((b: string) => isCourseBatch(b));
      if (hasAssignedCourseBatches) {
        // Any course batch grant automatically awards Quiz Premium (isPremium: true)
        targetUser.isPremium = true;
        if (!targetUser.premiumExpiresAt || targetUser.premiumPlan?.includes('demo') || (targetUser.premiumExpiresAt && new Date(targetUser.premiumExpiresAt).getTime() <= Date.now())) {
          targetUser.premiumExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        }
        if (!targetUser.premiumPlan || targetUser.premiumPlan === 'free' || targetUser.premiumPlan?.includes('demo')) {
          targetUser.premiumPlan = 'course_bundle_premium';
        }
      }
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
      }
    }

    const hasAdminCoursePerm = targetUser.adminPermissions?.includes('access_courses') || targetUser.adminPermissions?.includes('*');
    const hasCourseBatches = Array.isArray(targetUser.allowedBatches) && targetUser.allowedBatches.some((b: string) => isCourseBatch(b));

    // Ensure hasCourseAccess in DB is strictly derived from course batches or admin permissions (decoupled from isPremium)
    targetUser.hasCourseAccess = Boolean(hasAdminCoursePerm || hasCourseBatches);

    // If regular user or admin has revoked premium and has no course batches and no course perms:
    if (!targetUser.isPremium && !hasAdminCoursePerm && !hasCourseBatches && (!targetUser.allowedBatches || targetUser.allowedBatches.length === 0)) {
      if (targetUser.premiumPlan === 'admin_role_grant' || targetUser.premiumPlan?.includes('demo') || targetUser.premiumPlan?.startsWith('code:')) {
        targetUser.isPremium = false;
        targetUser.premiumExpiresAt = null;
        targetUser.premiumPlan = 'free';
      }
    }

    const finalUpdatedUser = await User.findOneAndUpdate(
      { _id: targetUser._id },
      {
        $set: {
          role: targetUser.role,
          adminPermissions: targetUser.adminPermissions,
          allowedBatches: targetUser.allowedBatches,
          isPremium: targetUser.isPremium,
          premiumExpiresAt: targetUser.premiumExpiresAt,
          premiumPlan: targetUser.premiumPlan,
          grantedBy: targetUser.grantedBy,
          hasCourseAccess: targetUser.hasCourseAccess,
        }
      },
      { returnDocument: 'after' }
    ).lean();

    invalidateUserCourseCache(cleanTarget);

    return NextResponse.json({
      success: true,
      message: `User ${targetUser.email} permissions updated successfully!`,
      user: {
        id: (finalUpdatedUser?._id || targetUser._id).toString(),
        name: finalUpdatedUser?.name || targetUser.name,
        email: finalUpdatedUser?.email || targetUser.email,
        role: finalUpdatedUser?.role || targetUser.role,
        adminPermissions: finalUpdatedUser?.adminPermissions || targetUser.adminPermissions,
        allowedBatches: finalUpdatedUser?.allowedBatches || targetUser.allowedBatches,
        isPremium: finalUpdatedUser?.isPremium ?? targetUser.isPremium,
      },
    });
  } catch (error) {
    console.error('Error updating user role/permissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}
