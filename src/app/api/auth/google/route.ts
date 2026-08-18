import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { PreApprovedEmail } from '@/models/PreApprovedEmail';
import { LaunchEvent } from '@/models/LaunchEvent';
import { attachSessionCookie } from '@/lib/session';

const SUPERADMIN_EMAIL = 'fykartik@gmail.com';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, image, googleId } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isSuperadmin = cleanEmail === SUPERADMIN_EMAIL;

    const conn = await connectToDatabase();

    if (conn) {
      let user = await User.findOne({ email: cleanEmail });
      const isNewUser = !user;

      let isPremium = isSuperadmin;
      let premiumExpiresAt: Date | null = null;
      let premiumPlan = isSuperadmin ? 'superadmin' : 'free';
      let grantedBy = isSuperadmin ? 'system' : '';

      if (user) {
        isPremium = user.isPremium || isSuperadmin;
        premiumExpiresAt = user.premiumExpiresAt || null;
        premiumPlan = user.premiumPlan || (isSuperadmin ? 'superadmin' : 'free');
        grantedBy = user.grantedBy || '';

        // Check if premium expired
        if (isPremium && !isSuperadmin && premiumExpiresAt && new Date(premiumExpiresAt) < new Date()) {
          isPremium = false;
          premiumPlan = 'expired';
        }
      }

      // Check PreApprovedEmail if not already premium
      if (!isPremium) {
        const preapproved = await PreApprovedEmail.findOne({ email: cleanEmail });
        if (preapproved) {
          isPremium = true;
          premiumPlan = 'preapproved';
          grantedBy = preapproved.addedBy || 'admin';
          if (preapproved.durationDays && preapproved.durationDays < 3650) {
            premiumExpiresAt = new Date(Date.now() + preapproved.durationDays * 24 * 60 * 60 * 1000);
          } else {
            premiumExpiresAt = null; // Lifetime
          }

          preapproved.isActivated = true;
          preapproved.activatedAt = new Date();
          await preapproved.save();
        }
      }

      // Check LaunchEvent if new user and still not premium
      if (isNewUser && !isPremium) {
        const activeEvent = await LaunchEvent.findOne({
          isActive: true,
          $expr: { $lt: ['$claimedCount', '$maxClaimCount'] }
        }).sort({ createdAt: -1 });

        if (activeEvent) {
          isPremium = true;
          premiumPlan = `launch_event:${activeEvent.title}`;
          grantedBy = `event:${activeEvent._id}`;
          if (activeEvent.durationDays && activeEvent.durationDays < 3650) {
            premiumExpiresAt = new Date(Date.now() + activeEvent.durationDays * 24 * 60 * 60 * 1000);
          } else {
            premiumExpiresAt = null;
          }

          activeEvent.claimedCount += 1;
          activeEvent.claimedUsers.push({ userEmail: cleanEmail, claimedAt: new Date() });
          await activeEvent.save();
        }
      }

      const updateData: any = {
        email: cleanEmail,
        name: name || 'Candidate',
        image: image || '',
        googleId: googleId || '',
        lastActiveAt: new Date(),
        isPremium,
        premiumExpiresAt,
        premiumPlan,
        grantedBy,
      };

      if (isSuperadmin) {
        updateData.role = 'superadmin';
        updateData.adminPermissions = ['manage_codes', 'manage_events', 'manage_users', 'manage_content'];
      }

      const savedUser = await User.findOneAndUpdate(
        { email: cleanEmail },
        { $set: updateData },
        { upsert: true, returnDocument: 'after' }
      ).lean();

      if (!savedUser) {
        return NextResponse.json({ success: false, error: 'Failed to save user' }, { status: 500 });
      }

      const userData = {
        id: savedUser._id.toString(),
        name: savedUser.name,
        email: savedUser.email,
        image: savedUser.image,
        role: savedUser.role || (isSuperadmin ? 'superadmin' : 'user'),
        adminPermissions: savedUser.adminPermissions || [],
        isPremium: !!savedUser.isPremium,
        premiumExpiresAt: savedUser.premiumExpiresAt ? new Date(savedUser.premiumExpiresAt).toISOString() : null,
        premiumPlan: savedUser.premiumPlan || 'free',
        totalScore: savedUser.totalScore || 0,
        testsCompleted: savedUser.testsCompleted || 0,
      };

      const response = NextResponse.json({
        success: true,
        data: userData
      });

      return attachSessionCookie(response, userData);
    }

    const userData = {
      name,
      email: cleanEmail,
      image,
      role: isSuperadmin ? ('superadmin' as const) : ('user' as const),
      adminPermissions: isSuperadmin ? ['manage_codes', 'manage_events', 'manage_users', 'manage_content'] : [],
      isPremium: isSuperadmin,
      premiumExpiresAt: null,
      premiumPlan: isSuperadmin ? 'superadmin' : 'free',
      totalScore: 0,
      testsCompleted: 0
    };
    const response = NextResponse.json({
      success: true,
      data: userData
    });
    return attachSessionCookie(response, userData);
  } catch (error) {
    console.error('Error in google auth API:', error);
    return NextResponse.json({ success: false, error: 'Auth failed' }, { status: 500 });
  }
}
