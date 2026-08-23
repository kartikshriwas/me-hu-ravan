import crypto from 'crypto';
import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'preptea_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'preptea_secure_session_secret_key_2026_99x#a!';

export interface SessionUser {
  id?: string;
  name: string;
  email: string;
  image?: string;
  role?: 'superadmin' | 'admin' | 'user';
  adminPermissions?: string[];
  allowedBatches?: string[];
  isPremium?: boolean;
  premiumExpiresAt?: string | null;
  premiumPlan?: string;
}

// Generate signed session token: base64Payload.signature
export function createSessionToken(user: SessionUser): string {
  const payload = JSON.stringify({
    id: user.id || '',
    name: user.name,
    email: user.email.toLowerCase().trim(),
    image: user.image || '',
    role: user.role || 'user',
    adminPermissions: user.adminPermissions || [],
    allowedBatches: user.allowedBatches || [],
    isPremium: !!user.isPremium,
    premiumExpiresAt: user.premiumExpiresAt || null,
    premiumPlan: user.premiumPlan || 'free',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days
  });

  const base64Payload = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base64Payload)
    .digest('base64url');

  return `${base64Payload}.${signature}`;
}

// Verify signed session token
export function verifySessionToken(token: string | undefined | null): SessionUser | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [base64Payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base64Payload)
    .digest('base64url');

  if (signature !== expectedSig) {
    return null; // Invalid signature
  }

  try {
    const payloadJson = Buffer.from(base64Payload, 'base64url').toString('utf-8');
    const data = JSON.parse(payloadJson);

    if (!data.email || !data.exp) return null;
    if (Math.floor(Date.now() / 1000) > data.exp) return null; // Expired

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      image: data.image,
      role: data.role || 'user',
      adminPermissions: data.adminPermissions || [],
      allowedBatches: data.allowedBatches || [],
      isPremium: !!data.isPremium,
      premiumExpiresAt: data.premiumExpiresAt || null,
      premiumPlan: data.premiumPlan || 'free',
    };
  } catch {
    return null;
  }
}

// Attach session HTTP-Only cookie to response
export function attachSessionCookie(response: NextResponse, user: SessionUser): NextResponse {
  const token = createSessionToken(user);
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60
  });
  return response;
}

// Clear session cookie from response
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  return response;
}

// Extract and verify session from incoming HTTP Request
export function getSessionFromRequest(request: Request): SessionUser | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`));
  const token = match ? decodeURIComponent(match[1]) : null;
  return verifySessionToken(token);
}
