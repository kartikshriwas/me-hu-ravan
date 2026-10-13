/**
 * Intelligent video quality resolution helper for offline downloads.
 * Only 4 allowed qualities for downloads: 1080, 720, 540, 360.
 *
 * When a requested quality is not available for a specific video,
 * this function finds the best matching asset by choosing the quality
 * greater than the selected one (closest upward match). If none is higher,
 * it falls back to the closest available quality.
 */

export interface DownloadQualityPreset {
  height: number;
  slug: string;
  displayName: string;
  name: string;
  desc: string;
  badge?: string;
  defaultSizeBytes: number;
}

export const DOWNLOAD_QUALITIES: DownloadQualityPreset[] = [
  {
    height: 1080,
    slug: '1080p',
    displayName: '1080p',
    name: 'Full HD (1080p)',
    desc: 'Maximum sharpness & detail • ~15–25 MB/lesson',
    badge: 'Crisp',
    defaultSizeBytes: 17.2 * 1024 * 1024,
  },
  {
    height: 720,
    slug: '720p',
    displayName: '720p',
    name: 'High (720p)',
    desc: 'Crisp & clear HD video • ~10–15 MB/lesson',
    badge: 'Recommended',
    defaultSizeBytes: 10.1 * 1024 * 1024,
  },
  {
    height: 540,
    slug: '540p',
    displayName: '540p',
    name: 'Medium (540p)',
    desc: 'Balanced data & quality • ~6–9 MB/lesson',
    badge: 'Balanced',
    defaultSizeBytes: 7.2 * 1024 * 1024,
  },
  {
    height: 360,
    slug: '360p',
    displayName: '360p',
    name: 'Standard (360p)',
    desc: 'Fast download & low storage • ~3–5 MB/lesson',
    badge: 'Standard',
    defaultSizeBytes: 4.8 * 1024 * 1024,
  },
];

export const ALLOWED_DOWNLOAD_HEIGHTS = [1080, 720, 540, 360] as const;

export function saveRememberedQuality(quality: string | number, shouldRemember?: boolean) {
  if (typeof window === 'undefined') return;
  try {
    const rawNum = parseInt(quality.toString().replace(/\D/g, ''), 10);
    // Find closest allowed quality (or pick greater if not standard)
    let finalHeight = 720;
    if (ALLOWED_DOWNLOAD_HEIGHTS.includes(rawNum as any)) {
      finalHeight = rawNum;
    } else if (rawNum > 720) {
      finalHeight = 1080;
    } else if (rawNum > 540) {
      finalHeight = 720;
    } else if (rawNum > 360) {
      finalHeight = 540;
    } else {
      finalHeight = 360;
    }

    const slug = `${finalHeight}p`;
    if (shouldRemember === true) {
      localStorage.setItem('preptea_remember_download_quality', 'true');
    } else if (shouldRemember === false) {
      localStorage.removeItem('preptea_remember_download_quality');
    }
    localStorage.setItem('preptea_preferred_quality', finalHeight.toString());
    localStorage.setItem('preptea_preferred_download_quality', slug);
    window.dispatchEvent(new CustomEvent('preptea_quality_changed', { detail: { quality: slug } }));
  } catch {}
}

export function getRememberedQuality(fallback: string = '720p'): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem('preptea_preferred_download_quality') || localStorage.getItem('preptea_preferred_quality');
    if (!raw) return fallback;
    const num = parseInt(raw.replace(/\D/g, ''), 10);
    if (ALLOWED_DOWNLOAD_HEIGHTS.includes(num as any)) {
      return `${num}p`;
    }
    // Normalize old / legacy stored settings (e.g. 144 or 480) to closest greater allowed quality
    if (num > 720) return '1080p';
    if (num > 540) return '720p';
    if (num > 360) return '540p';
    return '360p';
  } catch {}
  return fallback;
}

export interface QualityMatchResult<T> {
  asset: T;
  isExact: boolean;
  requestedQuality: string;
  actualQuality: string;
  availableQualities: string[];
}

export function getAssetTier(asset: { height?: number; slug?: string; displayName?: string }): number {
  const name = (asset.displayName || asset.slug || '').toLowerCase();
  if (name.includes('1080')) return 1080;
  if (name.includes('720')) return 720;
  if (name.includes('540')) return 540;
  if (name.includes('360')) return 360;

  const h = asset.height || 0;
  if (h >= 1000) return 1080;
  if (h >= 700) return 720;
  if (h >= 500) return 540;
  if (h >= 340) return 360;
  return h;
}

export function matchQualityWithFallback<T extends { height?: number; slug?: string; displayName?: string }>(
  assets: T[],
  preferredQuality?: string | number | null
): QualityMatchResult<T> | null {
  if (!assets || assets.length === 0) return null;

  const targetHeight =
    typeof preferredQuality === 'number'
      ? preferredQuality
      : parseInt((preferredQuality || '720').toString().replace(/\D/g, ''), 10) || 720;

  const requestedQuality = `${targetHeight}p`;
  const availableQualities = assets
    .map((a) => (a.displayName || (a.height ? `${a.height}p` : a.slug) || 'Unknown').trim())
    .filter((v, i, arr) => arr.indexOf(v) === i);

  // 1. Exact tier match check (by displayName '720p', height range, or exact height)
  const exact = assets.find((a) => {
    const tier = getAssetTier(a);
    return tier === targetHeight || a.height === targetHeight;
  });

  if (exact) {
    const tier = getAssetTier(exact);
    const label = `${tier || targetHeight}p`;
    return {
      asset: exact,
      isExact: true,
      requestedQuality,
      actualQuality: label,
      availableQualities,
    };
  }

  // 2. Look for best higher quality (closest upward match: quality greater than selected one)
  const higherAssets = assets
    .filter((a) => getAssetTier(a) > targetHeight || (a.height || 0) > targetHeight)
    .sort((a, b) => getAssetTier(a) - getAssetTier(b));

  if (higherAssets.length > 0) {
    const asset = higherAssets[0];
    const tier = getAssetTier(asset);
    const label = `${tier || asset.height}p`;
    const isActuallyExact = label === requestedQuality;
    return {
      asset,
      isExact: isActuallyExact,
      requestedQuality,
      actualQuality: label,
      availableQualities,
    };
  }

  // 3. Fallback to closest lower quality (if no quality is higher than selected)
  const lowerAssets = assets
    .filter((a) => getAssetTier(a) < targetHeight || (a.height || 0) < targetHeight)
    .sort((a, b) => getAssetTier(b) - getAssetTier(a));

  const fallbackAsset = lowerAssets.length > 0 ? lowerAssets[0] : assets[0];
  const tier = getAssetTier(fallbackAsset);
  const label = `${tier || fallbackAsset.height}p`;
  const isActuallyExact = label === requestedQuality;

  return {
    asset: fallbackAsset,
    isExact: isActuallyExact,
    requestedQuality,
    actualQuality: label,
    availableQualities,
  };
}

export function findBestMatchingAsset<T extends { height?: number; slug?: string; displayName?: string }>(
  assets: T[],
  preferredQuality?: string | number | null
): T | null {
  const result = matchQualityWithFallback(assets, preferredQuality);
  return result?.asset || null;
}
