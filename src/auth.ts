import NextAuth from 'next-auth';
import { cache } from 'react';
import { authConfig } from './auth.config';
import { connectToDatabase, resetDatabaseConnection } from '@/lib/db';
import { User } from '@/models/User';
import { PreApprovedEmail } from '@/models/PreApprovedEmail';
import { LaunchEvent } from '@/models/LaunchEvent';
import { SUPERADMIN_EMAIL } from '@/lib/adminAuth';
import { isCourseBatch } from '@/lib/batchAccess';
import { processPendingDemoActivation } from '@/lib/pendingDemoHelper';
import { processAutoDemoGrant } from '@/lib/autoDemoHelper';
import { invalidateUserCourseCache } from '@/lib/coursesAuth';
import { normalizeEmail, checkIsAltAccount } from '@/lib/altDetection';
import { headers, cookies } from 'next/headers';

const nextAuthResult = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google' || !user.email) return false;

      try {
        const email = user.email.toLowerCase().trim();
        const isSuperadmin = email === SUPERADMIN_EMAIL;

        let clientIp = '';
        let deviceCookieId = '';
        try {
          const reqHeaders = await headers();
          const rawIp = reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || reqHeaders.get('x-real-ip') || '';
          clientIp = rawIp.replace(/^::ffff:/i, '');

          const cookieStore = await cookies();
          deviceCookieId = cookieStore.get('__preptea_did')?.value || '';
        } catch {
          // ignore if headers/cookies not accessible in this context
        }

        const conn = await connectToDatabase();

        if (conn) {
          let dbUser = await User.findOne({ email });
          const isNewUser = !dbUser;

          let isAlt = dbUser?.isAlt || false;
          let altOfEmail = dbUser?.altOfEmail || '';
          let altReason = dbUser?.altReason || '';

          // Multi-technique alt account detection (normalized email, device cookie, IP collision):
          if (!isSuperadmin && !isAlt && dbUser?.role !== 'admin' && dbUser?.role !== 'superadmin') {
            const altResult = await checkIsAltAccount({
              email,
              clientIp,
              deviceId: deviceCookieId,
            });
            if (altResult.isAlt) {
              isAlt = true;
              altOfEmail = altResult.altOfEmail || '';
              altReason = altResult.reason || '';
            }
          }

          let isPremium = false;
          let premiumExpiresAt: Date | null = null;
          let premiumPlan = 'free';
          let grantedBy = '';

          if (dbUser) {
            isPremium = Boolean(dbUser.isPremium);
            premiumExpiresAt = dbUser.premiumExpiresAt || null;
            premiumPlan = dbUser.premiumPlan || 'free';
            grantedBy = dbUser.grantedBy || '';

            // Check if premium/demo expired for any user (including admin / superadmin)
            if ((isPremium || (typeof premiumPlan === 'string' && premiumPlan.includes('demo'))) && premiumExpiresAt && new Date(premiumExpiresAt) < new Date()) {
              isPremium = false;
              const isDemo = typeof premiumPlan === 'string' && (premiumPlan.includes('demo') || premiumPlan.includes('m_demo'));
              let demoMins = 15;
              const match = typeof premiumPlan === 'string' ? premiumPlan.match(/(\d+)m/) : null;
              if (match) demoMins = parseInt(match[1]);
              premiumPlan = isDemo ? `expired_demo:${demoMins}m` : 'expired';
              
              // Actively clear DB fields so they lose access everywhere
              await User.updateOne(
                { email },
                {
                  $set: {
                    isPremium: false,
                    premiumPlan,
                    allowedBatches: [],
                    hasCourseAccess: false,
                  }
                }
              );
              invalidateUserCourseCache(email);
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

          // Check LaunchEvent if new user and still not premium (and not an alt)
          if (isNewUser && !isPremium && !isAlt) {
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
            normalizedEmail: normalizeEmail(email),
            name: user.name || 'Candidate',
            image: user.image || '',
            googleId: account.providerAccountId || '',
            lastActiveAt: new Date(),
            isPremium,
            premiumExpiresAt,
            premiumPlan,
            grantedBy,
            lastIp: clientIp || dbUser?.lastIp || '',
          };

          if (isPremium) {
            updateData.hasHadDemoOrPremium = true;
          }

          if (isAlt) {
            updateData.isAlt = true;
            updateData.altOfEmail = altOfEmail;
            updateData.altReason = altReason;
            updateData.hasHadDemoOrPremium = true; // Never grant demo to alt
          }

          if (isSuperadmin) {
            updateData.role = 'superadmin';
            updateData.adminPermissions = ['manage_codes', 'manage_events', 'manage_users', 'manage_content'];
          }

          const addToSetObj: any = {};
          if (clientIp) addToSetObj.pastIps = clientIp;
          if (deviceCookieId) addToSetObj.deviceIds = deviceCookieId;

          const savedUser = await User.findOneAndUpdate(
            { email },
            { 
              $set: updateData,
              ...(Object.keys(addToSetObj).length > 0 ? { $addToSet: addToSetObj } : {}),
            },
            { upsert: true, returnDocument: 'after' }
          );

          if (savedUser && !savedUser.isPremium && !savedUser.isAlt) {
            await processAutoDemoGrant(savedUser, clientIp);
          }
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
      // Re-sync with DB on sign in, explicit update, missing token id, or after 1 minute
      const shouldSync = Boolean(user || trigger === 'update' || !token.id || (now - lastSync) > (60 * 1000));

      if (shouldSync && token.email) {
        try {
          // Implement a 6-second timeout for DB sync so cold starts can complete without blocking requests indefinitely
          const dbSyncPromise = (async () => {
            const conn = await connectToDatabase();
            if (conn) {
              let dbUser = await User.findOne({ email: token.email }).lean().maxTimeMS(5000);
              if (dbUser) {
                // Only check pending/auto demo for users with no prior demo/premium history
                const isSuperOrAdminUser = dbUser.role === 'superadmin' || dbUser.role === 'admin' || token.email === SUPERADMIN_EMAIL;
                if (!isSuperOrAdminUser && !dbUser.isPremium && !dbUser.hasHadDemoOrPremium && !dbUser.isAlt) {
                  const wasActivated = await processPendingDemoActivation(dbUser);
                  const wasAutoGranted = await processAutoDemoGrant(dbUser, dbUser.lastIp);
                  if (wasActivated || wasAutoGranted) {
                    const updatedUser = await User.findOne({ email: token.email }).lean().maxTimeMS(5000);
                    if (updatedUser) dbUser = updatedUser;
                  }
                }
                const userRole = dbUser.role || (token.email === SUPERADMIN_EMAIL ? 'superadmin' : 'user');
                const isSuperOrAdmin = userRole === 'superadmin' || userRole === 'admin' || token.email === SUPERADMIN_EMAIL;
                const adminPermissions = dbUser.adminPermissions || [];
                const allowedBatches = dbUser.allowedBatches || [];

                let isPremium = !!dbUser.isPremium;
                let userPlan = dbUser.premiumPlan || 'free';
                let userAllowedBatches = Array.isArray(dbUser.allowedBatches) ? [...dbUser.allowedBatches] : [];
                const isDemo = typeof userPlan === 'string' && (userPlan.includes('demo') || userPlan.includes('m_demo'));

                if ((isPremium || isDemo) && dbUser.premiumExpiresAt && new Date(dbUser.premiumExpiresAt) < new Date()) {
                  isPremium = false;
                  let demoMins = 15;
                  const match = typeof userPlan === 'string' ? userPlan.match(/(\d+)m/) : null;
                  if (match) demoMins = parseInt(match[1]);
                  userPlan = isDemo ? `expired_demo:${demoMins}m` : 'expired';
                  userAllowedBatches = [];

                  User.updateOne(
                    { _id: dbUser._id },
                    {
                      $set: {
                        isPremium: false,
                        premiumPlan: userPlan,
                        allowedBatches: [],
                        hasCourseAccess: false,
                      }
                    }
                  ).catch(() => {});
                  invalidateUserCourseCache(token.email as string);
                }

                const hasCourseBatches = !userPlan.startsWith('expired') && userAllowedBatches.some((b: string) => isCourseBatch(b));
                const hasAdminCoursePerm = adminPermissions.includes('access_courses') || adminPermissions.includes('*');
                const hasCourseAccess = Boolean(hasAdminCoursePerm || hasCourseBatches);

                token.id = dbUser._id.toString();
                token.role = userRole;
                token.adminPermissions = adminPermissions;
                token.allowedBatches = userAllowedBatches;
                token.isPremium = isPremium;
                token.premiumExpiresAt = dbUser.premiumExpiresAt ? new Date(dbUser.premiumExpiresAt).toISOString() : null;
                token.premiumPlan = userPlan;
                token.totalScore = dbUser.totalScore || 0;
                token.testsCompleted = dbUser.testsCompleted || 0;
                token.hasCourseAccess = hasCourseAccess;
                token.lastDbSync = now;
              }
            }
          })();

          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('MongoDB Sync Timeout')), 6000)
          );

          await Promise.race([dbSyncPromise, timeoutPromise]);
        } catch (error: any) {
          if (error?.name === 'MongooseServerSelectionError' || error?.message?.includes('timed out')) {
            await resetDatabaseConnection().catch(() => {});
          }
          // Soft warn for fallback so dev server doesn't treat intentional timeout fallback as an uncaught error
          console.warn('[Auth] DB user sync fallback to cached token:', error?.message || error);
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

export const handlers = nextAuthResult.handlers;
export const signIn = nextAuthResult.signIn;
export const signOut = nextAuthResult.signOut;
export const auth = cache(nextAuthResult.auth);
