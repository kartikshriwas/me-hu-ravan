'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { clearUserLocalData } from '@/lib/storage';

export interface AuthUser {
  id?: string;
  name: string;
  email: string;
  image?: string;
  role?: 'superadmin' | 'admin' | 'user';
  adminPermissions?: string[];
  isPremium?: boolean;
  premiumExpiresAt?: string | null;
  premiumPlan?: string;
  totalScore?: number;
  testsCompleted?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  handleGoogleSuccess: (credential: string) => Promise<void>;
  handleGoogleUserInfo: (userInfo: any) => Promise<void>;
  logout: () => void;
  getAvatarUrl: (user?: AuthUser | null) => string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  handleGoogleSuccess: async () => {},
  handleGoogleUserInfo: async () => {},
  logout: () => {},
  getAvatarUrl: () => '',
});

const USER_STORAGE_KEY = 'preptea_google_user';

export function getAvatarUrl(user?: AuthUser | null): string {
  if (user?.image && user.image.trim().length > 0) {
    return user.image;
  }
  const seed = user?.email || user?.name || 'PrepTeaCandidate';
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function initSession() {
      try {
        const res = await fetch('/api/auth/me');
        const json = await res.json();
        if (json.success && json.user) {
          setUser(json.user);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(json.user));
        } else {
          const stored = localStorage.getItem(USER_STORAGE_KEY);
          if (stored) {
            setUser(JSON.parse(stored));
          }
        }
      } catch (err) {
        console.error('Error loading session:', err);
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, []);

  const syncUserToBackend = async (googleUser: AuthUser) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googleUser),
      });
      const json = await res.json();
      const finalUser = json.data || googleUser;

      setUser(finalUser);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(finalUser));
    } catch (err) {
      console.error('Failed to sync google user:', err);
      setUser(googleUser);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(googleUser));
    }
  };

  const handleGoogleSuccess = async (credential: string) => {
    try {
      const decoded: any = jwtDecode(credential);
      const googleUser: AuthUser = {
        id: decoded.sub,
        name: decoded.name || decoded.email?.split('@')[0] || 'Google User',
        email: decoded.email,
        image: decoded.picture || getAvatarUrl({ name: decoded.name, email: decoded.email }),
        totalScore: 0,
        testsCompleted: 0,
      };
      await syncUserToBackend(googleUser);
    } catch (err) {
      console.error('Failed to process Google ID token:', err);
    }
  };

  const handleGoogleUserInfo = async (userInfo: any) => {
    try {
      const googleUser: AuthUser = {
        id: userInfo.sub,
        name: userInfo.name || userInfo.email?.split('@')[0] || 'Candidate',
        email: userInfo.email,
        image: userInfo.picture || getAvatarUrl({ name: userInfo.name, email: userInfo.email }),
        totalScore: 0,
        testsCompleted: 0,
      };
      await syncUserToBackend(googleUser);
    } catch (err) {
      console.error('Failed to process Google UserInfo:', err);
    }
  };

  const logout = async () => {
    if (user?.email) {
      clearUserLocalData(user.email);
    }
    clearUserLocalData(null);
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
  };

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    '326991203455-diis1nlvbbmffabevl9rebj73maiag40.apps.googleusercontent.com';

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthContext.Provider value={{ user, loading, handleGoogleSuccess, handleGoogleUserInfo, logout, getAvatarUrl }}>
        {children}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
