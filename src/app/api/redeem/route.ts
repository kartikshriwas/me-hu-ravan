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

    // Calculate expiry date
    let newExpiresAt: Date | null = null;
    const durationDays = redeemRecord.durationDays || 365;

    if (durationDays < 3650) {
      const now = new Date();
      newExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    }

    const existingUserDoc = await User.findOne({ email: userEmail });
    if (!existingUserDoc) {
      return NextResponse.json({ success: false, error: 'User record not found' }, { status: 404 });
    }

    const grantType = redeemRecord.grantType || 'all_premium';
    const codeGrantedCourses: string[] = redeemRecord.grantedCourses || [];

    let successMsg = '';

    if (grantType === 'all_premium') {
      existingUserDoc.isPremium = true;
      existingUserDoc.premiumExpiresAt = newExpiresAt;
      existingUserDoc.premiumPlan = redeemRecord.batchName ? `code:${redeemRecord.batchName}` : `code:${cleanCode}`;
      existingUserDoc.grantedBy = `code:${cleanCode}`;
      successMsg = `🎉 Full Premium activated for ${durationDays >= 3650 ? 'Lifetime' : `${durationDays} days`}!`;
    } else if (grantType === 'quizzes_only') {
      existingUserDoc.isPremium = true;
      existingUserDoc.premiumExpiresAt = newExpiresAt;
      existingUserDoc.premiumPlan = 'quizzes_only';
      existingUserDoc.grantedBy = `code:${cleanCode}`;
      successMsg = `🎯 Unlimited Practice Quiz Pass activated for ${durationDays >= 3650 ? 'Lifetime' : `${durationDays} days`}!`;
    } else if (grantType === 'specific_courses') {
      const mergedCourses = Array.from(new Set([...(existingUserDoc.grantedCourses || []), ...codeGrantedCourses]));
      existingUserDoc.grantedCourses = mergedCourses;
      if (!existingUserDoc.isPremium) {
        existingUserDoc.isPremium = true;
        existingUserDoc.premiumExpiresAt = newExpiresAt;
        existingUserDoc.premiumPlan = redeemRecord.batchName ? `course:${redeemRecord.batchName}` : 'course_access';
        existingUserDoc.grantedBy = `code:${cleanCode}`;
      }
      successMsg = `📚 Course access granted for ${codeGrantedCourses.length} course(s)!`;
    }

    existingUserDoc.lastActiveAt = new Date();
    await existingUserDoc.save();

    // Increment code usage
    redeemRecord.usedCount += 1;
    redeemRecord.usedBy.push({ userEmail, usedAt: new Date() });
    await redeemRecord.save();

    const freshUserData = {
      id: existingUserDoc._id.toString(),
      name: existingUserDoc.name,
      email: existingUserDoc.email,
      image: existingUserDoc.image,
      role: existingUserDoc.role || 'user',
      adminPermissions: existingUserDoc.adminPermissions || [],
      isPremium: existingUserDoc.isPremium,
      premiumExpiresAt: existingUserDoc.premiumExpiresAt ? existingUserDoc.premiumExpiresAt.toISOString() : null,
      premiumPlan: existingUserDoc.premiumPlan,
      grantedCourses: existingUserDoc.grantedCourses || [],
      totalScore: existingUserDoc.totalScore || 0,
      testsCompleted: existingUserDoc.testsCompleted || 0,
    };

    const response = NextResponse.json({
      success: true,
      message: successMsg,
      user: freshUserData,
    });

    return attachSessionCookie(response, freshUserData);
  } catch (error) {
    console.error('Error redeeming code:', error);
    return NextResponse.json({ success: false, error: 'Failed to redeem code' }, { status: 500 });
  }
}
