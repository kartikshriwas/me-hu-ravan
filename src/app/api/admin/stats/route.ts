import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { RedeemCode } from '@/models/RedeemCode';
import { LaunchEvent } from '@/models/LaunchEvent';
import { PreApprovedEmail } from '@/models/PreApprovedEmail';
import { Attempt } from '@/models/Attempt';

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
      return NextResponse.json({ success: false, error: 'Database connection error' }, { status: 500 });
    }

    // Fast-path: Superadmin bypasses extra User lookup query
    let isAdmin = isSuperadmin;
    if (!isAdmin) {
      const currentUser = await User.findOne({ email: cleanEmail }).select('role').lean();
      isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
    }

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access denied' }, { status: 403 });
    }

    // Execute count queries concurrently in parallel
    const [totalUsers, premiumUsers, totalCodes, activeEventsCount, totalAttempts, preapprovedCount] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isPremium: true }),
      RedeemCode.countDocuments(),
      LaunchEvent.countDocuments({ isActive: true }),
      Attempt.countDocuments(),
      PreApprovedEmail.countDocuments(),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        premiumUsers,
        freeUsers: totalUsers - premiumUsers,
        totalCodes,
        activeEventsCount,
        totalAttempts,
        preapprovedCount,
      },
    });
  } catch (error) {
    console.error('Error in admin stats API:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
