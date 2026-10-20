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
  reason?: 'ip_collision' | 'device_collision' | 'hardware_fingerprint' | 'subnet_hardware_match' | 'email_alias' | 'none';
}

/**
 * Extracts IPv4 /24 subnet (e.g. 152.57.12.89 -> 152.57.12)
 */
function getIpSubnet24(ip?: string): string | null {
  if (!ip || typeof ip !== 'string' || ip.includes(':')) return null;
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return null;
}

/**
 * Comprehensive multi-factor alt account check:
 * 1. Normalized Email Alias (e.g. Gmail dot/plus tricks)
 * 2. Persistent Device ID (localStorage + IndexedDB + Cookie zombie identifier)
 * 3. Physical Hardware Fingerprint (Canvas + WebGL + AudioContext GPU signature)
 * 4. Subnet /24 IP Range + Hardware Fingerprint Match (catches mobile hotspot/airplane mode toggling)
 * 5. Exact IP Collision (existing network history)
 */
export async function checkIsAltAccount(params: {
  email: string;
  clientIp?: string;
  deviceId?: string;
  hardwareFingerprint?: string;
}): Promise<AltCheckResult> {
  const { email, clientIp, deviceId, hardwareFingerprint } = params;
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

  // 2. Persistent Multi-Storage Device ID Match (same browser on same device)
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

  // 3. Physical Hardware / GPU Fingerprint Match
  // Matches physical GPU, WebGL driver, canvas rasterization, and CPU even if cache & storage are wiped!
  if (hardwareFingerprint && hardwareFingerprint.startsWith('hw_') && hardwareFingerprint.length > 5) {
    const existingHwUser = await User.findOne({
      email: { $ne: cleanEmail },
      hardwareFingerprint,
    }).select('_id email lastIp pastIps').lean();

    if (existingHwUser) {
      const cleanSubnet = getIpSubnet24(clientIp);
      const pastIps = Array.isArray(existingHwUser.pastIps) ? existingHwUser.pastIps : [];
      const hasSubnetMatch = cleanSubnet && (
        (existingHwUser.lastIp && existingHwUser.lastIp.startsWith(cleanSubnet)) ||
        pastIps.some((p: string) => p.startsWith(cleanSubnet))
      );

      return {
        isAlt: true,
        altOfEmail: existingHwUser.email,
        reason: hasSubnetMatch ? 'subnet_hardware_match' : 'hardware_fingerprint',
      };
    }
  }

  // 4. IP Collision Check (excluding localhost and loopback)
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
