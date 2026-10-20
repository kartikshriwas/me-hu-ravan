'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { clearUserLocalData } from '@/lib/storage';
import { syncLocalProgressToDb } from '@/lib/userProgressClient';

export interface AuthUser {
  id?: string;
  name: string;
  email: string;
  image?: string;
  role?: 'superadmin' | 'admin' | 'user';
  adminPermissions?: string[];
  allowedBatches?: string[];
  isPremium?: boolean;
  hasCourseAccess?: boolean;
  premiumExpiresAt?: string | null;
  premiumPlan?: string;
  totalScore?: number;
  testsCompleted?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
  getAvatarUrl: (user?: AuthUser | null) => string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: () => {},
  getAvatarUrl: () => '',
});

export function getAvatarUrl(user?: AuthUser | null): string {
  if (user?.image && user.image.trim().length > 0) {
    return user.image;
  }
  const seed = user?.email || user?.name || 'PrepTeaCandidate';
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
}

function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const user = (session?.user as AuthUser) || null;
  const loading = status === 'loading';

  useEffect(() => {
    if (!user?.email) return;

    // Initial sync
    syncLocalProgressToDb(true);

    // Global multi-device synchronization when tab is focused or became visible (only syncs if local data changed)
    const handleReconcile = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      syncLocalProgressToDb(false);
    };

    window.addEventListener('focus', handleReconcile);
    document.addEventListener('visibilitychange', handleReconcile);

    return () => {
      window.removeEventListener('focus', handleReconcile);
      document.removeEventListener('visibilitychange', handleReconcile);
    };
  }, [user?.email]);

  const logout = async () => {
    if (user?.email) {
      clearUserLocalData(user.email);
    }
    clearUserLocalData(null);
    await signOut({ callbackUrl: '/' });
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, getAvatarUrl }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false} refetchInterval={120}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </SessionProvider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
