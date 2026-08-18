import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { PreApprovedEmail } from '@/models/PreApprovedEmail';

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

    let isAdmin = isSuperadmin;
    if (!isAdmin) {
      const currentUser = await User.findOne({ email: cleanEmail }).select('role').lean();
      isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
    }

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const list = await PreApprovedEmail.find().sort({ createdAt: -1 }).limit(300).lean();

    return NextResponse.json({
      success: true,
      emails: list.map((item) => ({
        id: item._id.toString(),
        email: item.email,
        durationDays: item.durationDays,
        addedBy: item.addedBy,
        isActivated: item.isActivated,
        activatedAt: item.activatedAt ? new Date(item.activatedAt).toISOString() : null,
        createdAt: new Date(item.createdAt).toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching admin emails:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch preapproved emails' }, { status: 500 });
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

    const currentUser = await User.findOne({ email: cleanEmail }).lean();
    const isAdmin = isSuperadmin || currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { emails = [], durationDays = 365 } = body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ success: false, error: 'No email addresses provided' }, { status: 400 });
    }

    const numDuration = parseInt(durationDays) || 365;

    // Sanitize email list
    const validEmails = emails
      .map((e) => (typeof e === 'string' ? e.toLowerCase().trim() : ''))
      .filter((e) => e.includes('@') && e.length >= 5);

    if (validEmails.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid email addresses found' }, { status: 400 });
    }

    let addedCount = 0;
    let existingActivatedCount = 0;

    for (const targetEmail of validEmails) {
      let expiresAt: Date | null = null;
      if (numDuration < 3650) {
        expiresAt = new Date(Date.now() + numDuration * 24 * 60 * 60 * 1000);
      }

      // Check if user already registered in User collection
      const existingUser = await User.findOne({ email: targetEmail });
      if (existingUser) {
        existingUser.isPremium = true;
        existingUser.premiumExpiresAt = expiresAt;
        existingUser.premiumPlan = 'admin_grant';
        existingUser.grantedBy = cleanEmail;
        await existingUser.save();
        existingActivatedCount++;
      }

      // Record in PreApprovedEmail collection for automatic activation upon future signup/login
      await PreApprovedEmail.findOneAndUpdate(
        { email: targetEmail },
        {
          $set: {
            email: targetEmail,
            durationDays: numDuration,
            addedBy: cleanEmail,
            isActivated: !!existingUser,
            activatedAt: existingUser ? new Date() : null,
          },
        },
        { upsert: true }
      );
      addedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully granted premium to ${addedCount} email(s)! (${existingActivatedCount} active users upgraded immediately, remainder pre-approved for sign-in).`,
      count: addedCount,
    });
  } catch (error) {
    console.error('Error granting premium to emails:', error);
    return NextResponse.json({ success: false, error: 'Failed to process emails' }, { status: 500 });
  }
}
