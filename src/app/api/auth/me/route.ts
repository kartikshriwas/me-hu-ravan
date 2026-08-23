import { NextResponse } from 'next/server';
import { getSessionFromRequest, attachSessionCookie } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';

import { isPlatformGlobalFree } from '@/lib/globalSetting';

const SUPERADMIN_EMAIL = 'fykartik@gmail.com';

export async function GET(request: Request) {
  const sessionUser = getSessionFromRequest(request);
  if (!sessionUser) {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }

  try {
    const conn = await connectToDatabase();
    if (conn && sessionUser.email) {
      const cleanEmail = sessionUser.email.toLowerCase().trim();
      const isSuperadmin = cleanEmail === SUPERADMIN_EMAIL;

      const user = await User.findOne({ email: cleanEmail }).lean();
      if (user) {
        const { isGlobalFree, freeUntil } = await isPlatformGlobalFree();
        let isPremium = user.isPremium || isSuperadmin || isGlobalFree;
        let premiumExpiresAt = user.premiumExpiresAt || null;
        let premiumPlan = user.premiumPlan || (isSuperadmin ? 'superadmin' : 'free');

        if (!user.isPremium && !isSuperadmin && isGlobalFree) {
          if (freeUntil) {
            premiumExpiresAt = freeUntil;
          }
          if (premiumPlan === 'free') {
            premiumPlan = 'Global Free Access';
          }
        }

        // Check if premium expired
        if (isPremium && !isSuperadmin && !isGlobalFree && premiumExpiresAt && new Date(premiumExpiresAt) < new Date()) {
          isPremium = false;
        }

        const freshData = {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role || (isSuperadmin ? 'superadmin' : 'user'),
          adminPermissions: user.adminPermissions || [],
          isPremium,
          premiumExpiresAt: premiumExpiresAt ? new Date(premiumExpiresAt).toISOString() : null,
          premiumPlan,
          totalScore: user.totalScore || 0,
          testsCompleted: user.testsCompleted || 0,
        };

        const response = NextResponse.json({
          success: true,
          user: freshData
        });

        return attachSessionCookie(response, freshData);
      }
    }
  } catch (error) {
    console.error('Error fetching me status:', error);
  }

  return NextResponse.json({
    success: true,
    user: sessionUser
  });
}
