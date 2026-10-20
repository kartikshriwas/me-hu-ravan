import { User } from '@/models/User';

/**
 * Normalizes an email address to detect aliases.
 * Specifically for Gmail and Googlemail:
 * - Drops all dots (.) in the username (Gmail ignores dots)
 * - Drops everything after '+' (plus tagging)
 * E.g., 'john.doe+test@gmail.com' -> 'johndoe@gmail.com'
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.toLowerCase().trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex === -1) return trimmed;

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);

  if (domainPart === 'gmail.com' || domainPart === 'googlemail.com') {
    const cleanLocal = localPart.replace(/\+.*$/, '').replace(/\./g, '');
    return `${cleanLocal}@gmail.com`;
  }

  // Generic plus-addressing for other providers (Outlook, iCloud, Proton, etc.)
  const cleanLocal = localPart.replace(/\+.*$/, '');
  return `${cleanLocal}@${domainPart}`;
}

export interface AltCheckResult {
  isAlt: boolean;
  altOfEmail?: string;
  reason?: 'ip_collision' | 'device_collision' | 'email_alias' | 'none';
}

/**
 * Comprehensive multi-factor alt account check:
 * 1. Normalized Email Alias (e.g. Gmail dot/plus tricks)
 * 2. Persistent Device ID (localStorage browser identifier)
 * 3. IP Collision (existing network history)
 */
export async function checkIsAltAccount(params: {
  email: string;
  clientIp?: string;
  deviceId?: string;
}): Promise<AltCheckResult> {
  const { email, clientIp, deviceId } = params;
  const cleanEmail = email.toLowerCase().trim();
  const normalized = normalizeEmail(cleanEmail);

  // 1. Normalized Email Check (catches dot/plus tricks immediately)
  if (normalized) {
    const existingAlias = await User.findOne({
      email: { $ne: cleanEmail },
      $or: [
        { normalizedEmail: normalized },
        { email: normalized },
      ],
    }).select('_id email').lean();

    if (existingAlias) {
      return {
        isAlt: true,
        altOfEmail: existingAlias.email,
        reason: 'email_alias',
      };
    }
  }

  // 2. Persistent Device ID Match (same browser on same device)
  if (deviceId && deviceId.length > 5 && deviceId !== 'unknown') {
    const existingDeviceUser = await User.findOne({
      email: { $ne: cleanEmail },
      deviceIds: deviceId,
    }).select('_id email').lean();

    if (existingDeviceUser) {
      return {
        isAlt: true,
        altOfEmail: existingDeviceUser.email,
        reason: 'device_collision',
      };
    }
  }

  // 3. IP Collision Check (excluding localhost and loopback)
  if (clientIp && clientIp !== '127.0.0.1' && clientIp !== 'localhost' && clientIp !== '::1') {
    const existingIpUser = await User.findOne({
      email: { $ne: cleanEmail },
      $or: [
        { pastIps: clientIp },
        { lastIp: clientIp },
      ],
    }).select('_id email').lean();

    if (existingIpUser) {
      return {
        isAlt: true,
        altOfEmail: existingIpUser.email,
        reason: 'ip_collision',
      };
    }
  }

  return { isAlt: false, reason: 'none' };
}
