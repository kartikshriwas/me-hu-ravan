import { NextResponse } from 'next/server';
import { getSessionFromRequest, attachSessionCookie } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { RedeemCode } from '@/models/RedeemCode';

export async function POST(request: Request) {
  try {
    const sessionUser = getSessionFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Sign in required to redeem code' }, { status: 401 });
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

    const redeemRecord = await RedeemCode.findOne({ code: cleanCode, isActive: true });

    if (!redeemRecord) {
      return NextResponse.json({ success: false, error: 'Invalid or inactive redeem code' }, { status: 404 });
    }

    // Check code expiration date
    if (redeemRecord.expiresAt && new Date(redeemRecord.expiresAt) < new Date()) {
      return NextResponse.json({ success: false, error: 'This redeem code has expired' }, { status: 400 });
    }

    // Check usage limits
    if (redeemRecord.usedCount >= redeemRecord.maxUses) {
      return NextResponse.json({ success: false, error: 'Redeem code usage limit reached' }, { status: 400 });
    }

    const userEmail = sessionUser.email.toLowerCase().trim();

    // Check if user already used this code
    const alreadyUsed = redeemRecord.usedBy.some((u) => u.userEmail.toLowerCase() === userEmail);
    if (alreadyUsed) {
      return NextResponse.json({ success: false, error: 'You have already redeemed this code' }, { status: 400 });
    }

    // Calculate premium expiry
    let newExpiresAt: Date | null = null;
    const durationDays = redeemRecord.durationDays || 365;

    if (durationDays < 3650) {
      // 3650 days (~10 yrs) treated as Lifetime
      const now = new Date();
      newExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    }

    const batchNameToGrant = redeemRecord.batchName || 'General';

    // Update User premium status in DB
    const updatedUser = await User.findOneAndUpdate(
      { email: userEmail },
      {
        $set: {
          isPremium: true,
          premiumExpiresAt: newExpiresAt,
          premiumPlan: `code:${cleanCode}`,
          grantedBy: `code:${cleanCode}`,
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

    // Increment code usage
    redeemRecord.usedCount += 1;
    redeemRecord.usedBy.push({ userEmail, usedAt: new Date() });
    await redeemRecord.save();

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

    return attachSessionCookie(response, freshUserData);
  } catch (error) {
    console.error('Error redeeming code:', error);
    return NextResponse.json({ success: false, error: 'Failed to redeem code' }, { status: 500 });
  }
}
