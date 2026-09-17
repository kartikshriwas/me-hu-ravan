import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

/**
 * L-1: NextAuth type augmentation to eliminate `as any` casts throughout the codebase.
 * Defines the custom user properties embedded in JWT and session objects.
 */

declare module 'next-auth' {
  interface User extends DefaultUser {
    id: string;
    role: 'superadmin' | 'admin' | 'user';
    adminPermissions: string[];
    allowedBatches: string[];
    isPremium: boolean;
    premiumExpiresAt: string | null;
    premiumPlan: string;
    totalScore: number;
    testsCompleted: number;
    hasCourseAccess: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: 'superadmin' | 'admin' | 'user';
      adminPermissions: string[];
      allowedBatches: string[];
      isPremium: boolean;
      premiumExpiresAt: string | null;
      premiumPlan: string;
      totalScore: number;
      testsCompleted: number;
      hasCourseAccess: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    role: 'superadmin' | 'admin' | 'user';
    adminPermissions: string[];
    allowedBatches: string[];
    isPremium: boolean;
    premiumExpiresAt: string | null;
    premiumPlan: string;
    totalScore: number;
    testsCompleted: number;
    hasCourseAccess: boolean;
  }
}
