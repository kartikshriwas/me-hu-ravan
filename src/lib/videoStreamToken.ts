/**
 * Secure Video Stream Token Generation & Verification
 * Used to obfuscate and protect video delivery URLs so raw Wistia CDN URLs
 * are never exposed in API responses, network tabs, or DOM video tags.
 */

const SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'preptea-secure-video-token-2026-key';

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function xorCipher(inputBytes: Uint8Array, keyBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(inputBytes.length);
  for (let i = 0; i < inputBytes.length; i++) {
    out[i] = inputBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return out;
}

async function signString(str: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(str));
  return bytesToBase64Url(new Uint8Array(sig));
}

/**
 * Creates an encrypted, signed streaming ticket for a video asset.
 */
export async function createStreamTicket(
  targetUrl: string,
  videoId: string,
  height?: number
): Promise<string> {
  const enc = new TextEncoder();
  const kBytes = enc.encode(SECRET);
  const uBytes = enc.encode(targetUrl);
  const encUrl = bytesToBase64Url(xorCipher(uBytes, kBytes));

  const payloadObj = {
    u: encUrl,
    id: videoId,
    h: height || 0,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };

  const payloadStr = bytesToBase64Url(enc.encode(JSON.stringify(payloadObj)));
  const sig = await signString(payloadStr);
  return `${payloadStr}.${sig}`;
}

/**
 * Verifies and decrypts a streaming ticket.
 * Returns null if the ticket has expired, signature is invalid, or payload is corrupted.
 */
export async function verifyStreamTicket(
  ticket: string
): Promise<{ targetUrl: string; videoId: string; height?: number } | null> {
  if (!ticket || typeof ticket !== 'string') return null;
  const parts = ticket.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, sig] = parts;

  const expectedSig = await signString(payloadStr);
  if (expectedSig !== sig) return null;

  try {
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const kBytes = enc.encode(SECRET);
    const jsonBytes = base64UrlToBytes(payloadStr);
    const parsed = JSON.parse(dec.decode(jsonBytes));

    if (!parsed.exp || parsed.exp < Date.now()) return null;
    if (!parsed.u) return null;

    const encUBytes = base64UrlToBytes(parsed.u);
    const targetUrl = dec.decode(xorCipher(encUBytes, kBytes));
    return {
      targetUrl,
      videoId: parsed.id,
      height: parsed.h,
    };
  } catch {
    return null;
  }
}
