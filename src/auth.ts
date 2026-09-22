import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { PreApprovedEmail } from '@/models/PreApprovedEmail';
import { LaunchEvent } from '@/models/LaunchEvent';
import { SUPERADMIN_EMAIL } from '@/lib/adminAuth';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google' || !user.email) return false;

      try {
        const email = user.email.toLowerCase().trim();
        const isSuperadmin = email === SUPERADMIN_EMAIL;

        const conn = await connectToDatabase();

        if (conn) {
          let dbUser = await User.findOne({ email });
          const isNewUser = !dbUser;

          let isPremium = isSuperadmin;
          let premiumExpiresAt: Date | null = null;
          let premiumPlan = isSuperadmin ? 'superadmin' : 'free';
          let grantedBy = isSuperadmin ? 'system' : '';

          if (dbUser) {
            isPremium = dbUser.isPremium || isSuperadmin;
            premiumExpiresAt = dbUser.premiumExpiresAt || null;
            premiumPlan = dbUser.premiumPlan || (isSuperadmin ? 'superadmin' : 'free');
            grantedBy = dbUser.grantedBy || '';

            // Check if premium expired
            if (isPremium && !isSuperadmin && premiumExpiresAt && new Date(premiumExpiresAt) < new Date()) {
              isPremium = false;
              premiumPlan = 'expired';
              
              // Actively clear DB fields so they lose access everywhere
              await User.updateOne(
                { email },
                {
                  $set: {
                    isPremium: false,
                    premiumPlan: 'expired',
                    allowedBatches: []
                  }
                }
              );
            }
          }

          // Check PreApprovedEmail if not already premium
          if (!isPremium) {
            const preapproved = await PreApprovedEmail.findOne({ email });
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
            // SECURITY: Atomic claim to prevent race condition double-spending
            const claimedEvent = await LaunchEvent.findOneAndUpdate(
              {
                isActive: true,
                $expr: { $lt: ['$claimedCount', '$maxClaimCount'] },
                'claimedUsers.userEmail': { $ne: email }, // prevent double-claim
              },
              {
                $inc: { claimedCount: 1 },
                $push: { claimedUsers: { userEmail: email, claimedAt: new Date() } },
              },
              { sort: { createdAt: -1 }, returnDocument: 'after' }
            );

            if (claimedEvent) {
              isPremium = true;
              premiumPlan = `launch_event:${claimedEvent.title}`;
              grantedBy = `event:${claimedEvent._id}`;
              if (claimedEvent.durationDays && claimedEvent.durationDays < 3650) {
                premiumExpiresAt = new Date(Date.now() + claimedEvent.durationDays * 24 * 60 * 60 * 1000);
              } else {
                premiumExpiresAt = null;
              }
            }
          }

          const updateData: any = {
            email,
            name: user.name || 'Candidate',
            image: user.image || '',
            googleId: account.providerAccountId || '',
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

          await User.findOneAndUpdate(
            { email },
            { $set: updateData },
            { upsert: true }
          );
        }
        return true;
      } catch (error) {
        console.error('Error during NextAuth signIn:', error);
        return false;
      }
    },
    async jwt({ token, user, trigger, session }) {
      const now = Date.now();
      const lastSync = (token.lastDbSync as number) || 0;
      const shouldSync = user || trigger === 'update' || (now - lastSync) > 10000;

      if (shouldSync && token.email) {
        try {
          const conn = await connectToDatabase();
          if (conn) {
            const dbUser = await User.findOne({ email: token.email }).lean();
            if (dbUser) {
              token.id = dbUser._id.toString();
              token.role = dbUser.role || (token.email === SUPERADMIN_EMAIL ? 'superadmin' : 'user');
              token.adminPermissions = dbUser.adminPermissions || [];
              token.allowedBatches = dbUser.allowedBatches || [];
              token.isPremium = !!dbUser.isPremium;
              token.premiumExpiresAt = dbUser.premiumExpiresAt ? new Date(dbUser.premiumExpiresAt).toISOString() : null;
              token.premiumPlan = dbUser.premiumPlan || 'free';
              token.totalScore = dbUser.totalScore || 0;
              token.testsCompleted = dbUser.testsCompleted || 0;
              token.hasCourseAccess = !!dbUser.hasCourseAccess;
              token.lastDbSync = now;
            }
          }
        } catch (error) {
          console.error('Error populating JWT with DB user:', error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).adminPermissions = token.adminPermissions;
        (session.user as any).allowedBatches = token.allowedBatches;
        (session.user as any).isPremium = token.isPremium;
        (session.user as any).premiumExpiresAt = token.premiumExpiresAt;
        (session.user as any).premiumPlan = token.premiumPlan;
        (session.user as any).totalScore = token.totalScore;
        (session.user as any).testsCompleted = token.testsCompleted;
        (session.user as any).hasCourseAccess = token.hasCourseAccess;
      }
      return session;
    },
  },
});
