'use client';

/**
 * Advanced Client-Side Hardware & Multi-Storage Fingerprinting Engine
 * 
 * Works even when:
 * 1. User clears LocalStorage (resurrects from IndexedDB & Persistent Cookie)
 * 2. User clears Cookies (resurrects from LocalStorage & IndexedDB)
 * 3. User uses Incognito / Private Browsing (Canvas + WebGL + Hardware GPU hash matches)
 */

// Simple fast 32-bit FNV-1a hash
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

// 1. Canvas 2D Rasterization Fingerprint
// Renders complex curves, gradients, emojis, and font ligatures.
// Differences in GPU antialiasing, sub-pixel rendering, and OS font engines produce a unique hash.
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(0.5, '#6366f1');
    grad.addColorStop(1, '#10b981');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text with subtle font smoothing differences
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial", "Helvetica", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PrepTea-Shield 🎯 2026 ~ <canvas>', 6, 8);

    ctx.font = '12px "Times New Roman", serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Secure-Hardware-Token', 10, 32);

    // Geometry & curves (tests GPU floating-point precision)
    ctx.beginPath();
    ctx.arc(200, 30, 18, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const dataUrl = canvas.toDataURL();
    return fnv1a(dataUrl);
  } catch {
    return 'canvas-err';
  }
}

// 2. WebGL GPU Hardware Unmasked Renderer
// Extracts exact physical GPU chip model and graphics driver string
function getWebGLFingerprint(): { renderer: string; vendor: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return { renderer: 'no-gl', vendor: 'no-gl' };

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) {
      return {
        renderer: gl.getParameter(gl.RENDERER) || 'generic-renderer',
        vendor: gl.getParameter(gl.VENDOR) || 'generic-vendor',
      };
    }

    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unmasked-unknown';
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unmasked-unknown';
    return { renderer: String(renderer), vendor: String(vendor) };
  } catch {
    return { renderer: 'gl-err', vendor: 'gl-err' };
  }
}

// 3. AudioContext DSP Filter Fingerprint
// Evaluates floating-point audio processing quirks of the sound card/audio driver
async function getAudioFingerprint(): Promise<string> {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return 'no-audio';

    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(10000, ctx.currentTime);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-50, ctx.currentTime);
    comp.knee.setValueAtTime(40, ctx.currentTime);
    comp.ratio.setValueAtTime(12, ctx.currentTime);
    comp.attack.setValueAtTime(0, ctx.currentTime);
    comp.release.setValueAtTime(0.25, ctx.currentTime);

    osc.connect(comp);
    comp.connect(ctx.destination);
    osc.start(0);

    const rendered = await ctx.startRendering();
    const data = rendered.getChannelData(0);
    let sum = 0;
    for (let i = 4500; i < 5000; i++) {
      sum += Math.abs(data[i]);
    }
    return sum ? fnv1a(sum.toString()) : 'audio-silent';
  } catch {
    return 'audio-err';
  }
}

// 4. Multi-Storage Zombie UUID Synchronization (LocalStorage + IndexedDB + Cookie)
const STORAGE_KEY = 'preptea_device_uuid';
const COOKIE_NAME = '__preptea_did';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

function setCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  // 10 years persistent cookie
  const maxAge = 10 * 365 * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

// Read/write from IndexedDB
function getIndexedDbId(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (!window.indexedDB) return resolve(null);
      const req = window.indexedDB.open('preptea_telemetry_db', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('device_meta');
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction('device_meta', 'readonly');
          const store = tx.objectStore('device_meta');
          const getReq = store.get(STORAGE_KEY);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function setIndexedDbId(id: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (!window.indexedDB) return resolve();
      const req = window.indexedDB.open('preptea_telemetry_db', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('device_meta');
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction('device_meta', 'readwrite');
          const store = tx.objectStore('device_meta');
          store.put(id, STORAGE_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Resurrects device UUID across LocalStorage, IndexedDB, and Cookie.
 * If user clears any 1 or 2 storage layers, the remaining layer automatically resurrects the others.
 */
async function syncZombieDeviceId(): Promise<string> {
  let idFromLocal: string | null = null;
  let idFromCookie: string | null = null;
  let idFromIdb: string | null = null;

  try {
    idFromLocal = localStorage.getItem(STORAGE_KEY);
  } catch {}

  try {
    idFromCookie = getCookie(COOKIE_NAME);
  } catch {}

  try {
    idFromIdb = await getIndexedDbId();
  } catch {}

  // Find any surviving ID
  const survivingId = idFromLocal || idFromCookie || idFromIdb;

  const finalId = survivingId || `dev_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

  // Resurrect across all 3 storage mechanisms
  try {
    if (!idFromLocal || idFromLocal !== finalId) {
      localStorage.setItem(STORAGE_KEY, finalId);
    }
  } catch {}

  try {
    if (!idFromCookie || idFromCookie !== finalId) {
      setCookie(COOKIE_NAME, finalId);
    }
  } catch {}

  try {
    if (!idFromIdb || idFromIdb !== finalId) {
      await setIndexedDbId(finalId);
    }
  } catch {}

  return finalId;
}

export interface DeviceIdentity {
  deviceId: string;
  hardwareFingerprint: string;
}

let cachedIdentity: DeviceIdentity | null = null;

/**
 * Computes deterministic physical Hardware Fingerprint and synchronizes Zombie Device ID.
 */
export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (cachedIdentity) return cachedIdentity;

  const deviceId = await syncZombieDeviceId();

  // Compute immutable hardware factors
  const canvasHash = getCanvasFingerprint();
  const { renderer, vendor } = getWebGLFingerprint();
  const audioHash = await getAudioFingerprint();

  const screenRes = typeof window !== 'undefined'
    ? `${window.screen.availWidth}x${window.screen.availHeight}x${window.screen.colorDepth}`
    : '1920x1080x24';

  const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const mem = typeof navigator !== 'undefined' ? (navigator as any).deviceMemory || 4 : 4;
  const platform = typeof navigator !== 'undefined' ? navigator.platform || 'unknown' : 'unknown';
  const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;
  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC';

  const rawHardwareString = [
    canvasHash,
    renderer,
    vendor,
    audioHash,
    screenRes,
    pixelRatio,
    cores,
    mem,
    platform,
    touchPoints,
    tz,
  ].join('||');

  const hardwareFingerprint = `hw_${fnv1a(rawHardwareString)}`;

  cachedIdentity = {
    deviceId,
    hardwareFingerprint,
  };

  return cachedIdentity;
}
