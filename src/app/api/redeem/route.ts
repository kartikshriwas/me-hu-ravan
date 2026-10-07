import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { RedeemCode } from '@/models/RedeemCode';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    const session = await auth();
  const sessionUser = session?.user as any;
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Sign in required to redeem code' }, { status: 401 });
    }

    // H-1: Rate limit redeem attempts — 10 per minute per user
    const limiterKey = `redeem:${sessionUser.email || getClientIp(request)}`;
    const { allowed } = rateLimit(limiterKey, 10, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many redeem attempts. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'Redeem code required' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();
    const conn = await connectToDatabase();

    if (!conn) {
      return NextResponse.json({ success: false, error: 'Database connection failed' }, { status: 500 });
    }

    const userEmail = sessionUser.email.toLowerCase().trim();

    // SECURITY: Atomic redeem to prevent race condition double-spending
    // Single query validates: active, not expired, not maxed out, not already used by this user
    const redeemResult = await RedeemCode.findOneAndUpdate(
      {
        code: cleanCode,
        isActive: true,
        $expr: { $lt: ['$usedCount', '$maxUses'] },
        'usedBy.userEmail': { $ne: userEmail }, // prevent double-redeem
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      },
      {
        $inc: { usedCount: 1 },
        $push: { usedBy: { userEmail, usedAt: new Date() } },
      },
      { returnDocument: 'after' }
    );

    if (!redeemResult) {
      // Determine specific error by reading without update
      const existingCode = await RedeemCode.findOne({ code: cleanCode });
      if (!existingCode || !existingCode.isActive) {
        return NextResponse.json({ success: false, error: 'Invalid or inactive redeem code' }, { status: 404 });
      }
      if (existingCode.expiresAt && new Date(existingCode.expiresAt) < new Date()) {
        return NextResponse.json({ success: false, error: 'This redeem code has expired' }, { status: 400 });
      }
      if (existingCode.usedCount >= existingCode.maxUses) {
        return NextResponse.json({ success: false, error: 'Redeem code usage limit reached' }, { status: 400 });
      }
      if (existingCode.usedBy.some((u) => u.userEmail.toLowerCase() === userEmail)) {
        return NextResponse.json({ success: false, error: 'You have already redeemed this code' }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: 'Unable to redeem code' }, { status: 400 });
    }

    // Calculate premium expiry
    let newExpiresAt: Date | null = null;
    const durationDays = redeemResult.durationDays || 365;

    if (durationDays < 3650) {
      // 3650 days (~10 yrs) treated as Lifetime
      const now = new Date();
      newExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    }

    const batchNameToGrant = redeemResult.batchName || 'General';

    // Update User premium status in DB
    const updatedUser = await User.findOneAndUpdate(
      { email: userEmail },
      {
        $set: {
          isPremium: true,
          premiumExpiresAt: newExpiresAt,
          premiumPlan: `code:${cleanCode}`,
          grantedBy: redeemResult.createdBy || 'redeem_code',
          hasHadDemoOrPremium: true,
          lastActiveAt: new Date(),
        },
        $addToSet: {
          allowedBatches: batchNameToGrant,
        },
      },
      { returnDocument: 'after' }
    ).lean();

    if (!updatedUser) {
      return NextResponse.json({ success: false, error: 'User record not found' }, { status: 404 });
    }

    const freshUserData = {
      id: updatedUser._id.toString(),
      name: updatedUser.name,
      email: updatedUser.email,
      image: updatedUser.image,
      role: updatedUser.role || 'user',
      adminPermissions: updatedUser.adminPermissions || [],
      allowedBatches: updatedUser.allowedBatches || [],
      isPremium: true,
      premiumExpiresAt: newExpiresAt ? newExpiresAt.toISOString() : null,
      premiumPlan: updatedUser.premiumPlan,
      totalScore: updatedUser.totalScore || 0,
      testsCompleted: updatedUser.testsCompleted || 0,
    };

    const response = NextResponse.json({
      success: true,
      message: `🎉 Premium activated successfully! Access granted for ${durationDays >= 3650 ? 'Lifetime' : `${durationDays} days`}.`,
      user: freshUserData,
    });

    return response;
  } catch (error) {
    console.error('Error redeeming code:', error);
    return NextResponse.json({ success: false, error: 'Failed to redeem code' }, { status: 500 });
  }
}
