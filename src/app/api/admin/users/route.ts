import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';

const SUPERADMIN_EMAIL = 'fykartik@gmail.com';

export async function GET(request: Request) {
  try {
    const sessionUser = getSessionFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const cleanEmail = sessionUser.email.toLowerCase().trim();
    const isSuperadmin = cleanEmail === SUPERADMIN_EMAIL;

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    // Fast-path: Superadmin bypasses extra User lookup query
    let isAdmin = isSuperadmin;
    if (!isAdmin) {
      const currentUser = await User.findOne({ email: cleanEmail }).select('role').lean();
      isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
    }

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const users = await User.find()
      .select('_id name email image role adminPermissions isPremium premiumExpiresAt premiumPlan totalScore testsCompleted createdAt')
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
    const sessionUser = getSessionFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const cleanEmail = sessionUser.email.toLowerCase().trim();
    const isSuperadmin = cleanEmail === SUPERADMIN_EMAIL;

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    let isSuperOrAdmin = isSuperadmin;
    if (!isSuperOrAdmin) {
      const currentUser = await User.findOne({ email: cleanEmail }).select('role').lean();
      isSuperOrAdmin = currentUser?.role === 'superadmin';
    }

    // Only Superadmin can grant/revoke Admin role or permissions
    if (!isSuperOrAdmin) {
      return NextResponse.json({ success: false, error: 'Only Super Admin can manage admin permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { targetEmail, role, adminPermissions, isPremium, durationDays } = body;

    if (!targetEmail || typeof targetEmail !== 'string') {
      return NextResponse.json({ success: false, error: 'Target email is required' }, { status: 400 });
    }

    const cleanTarget = targetEmail.toLowerCase().trim();

    // Prevent demoting primary superadmin
    if (cleanTarget === SUPERADMIN_EMAIL && role && role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Primary Super Admin role cannot be modified' }, { status: 400 });
    }

    const targetUser = await User.findOne({ email: cleanTarget });
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (role && ['admin', 'user'].includes(role)) {
      targetUser.role = role;
    }

    if (Array.isArray(adminPermissions)) {
      targetUser.adminPermissions = adminPermissions;
    }

    if (typeof isPremium === 'boolean') {
      targetUser.isPremium = isPremium;
      if (isPremium) {
        const numDur = parseInt(durationDays) || 365;
        targetUser.premiumExpiresAt = numDur < 3650 ? new Date(Date.now() + numDur * 24 * 60 * 60 * 1000) : null;
        targetUser.premiumPlan = 'admin_role_grant';
        targetUser.grantedBy = cleanEmail;
      }
    }

    await targetUser.save();

    return NextResponse.json({
      success: true,
      message: `User ${targetUser.email} permissions updated successfully!`,
      user: {
        id: targetUser._id.toString(),
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        adminPermissions: targetUser.adminPermissions,
        isPremium: targetUser.isPremium,
      },
    });
  } catch (error) {
    console.error('Error updating user role/permissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}
