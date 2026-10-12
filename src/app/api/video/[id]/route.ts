import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// In-memory cache for parsed video metadata (1 hour TTL)
const videoCache = new Map<string, { data: any; expiry: number }>();
const VIDEO_CACHE_TTL_MS = 60 * 60 * 1000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Session verification
    const sessionAuth = await auth();
    const session = sessionAuth?.user as any;
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid Video ID' }, { status: 400 });
    }

    const now = Date.now();
    const cached = videoCache.get(id);
    if (cached && cached.expiry > now) {
      return NextResponse.json({
        success: true,
        video: cached.data,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800, max-age=3600' }
      });
    }

    // 2. Fetch Wistia metadata with retry loop to handle transient network/socket drops
    const urls = [
      `https://fast.wistia.com/embed/medias/${id}.json`,
      `https://fast.wistia.net/embed/medias/${id}.json`,
    ];

    let res: Response | null = null;
    let lastErr: any = null;

    for (const wistiaUrl of urls) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await fetch(wistiaUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
            },
            cache: 'no-store',
          });
          if (res.ok) break;
        } catch (err) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      if (res && res.ok) break;
    }

    if (!res || !res.ok) {
      console.error(`Wistia fetch failed for video ID ${id}:`, lastErr || res?.status);
      return NextResponse.json(
        { success: false, error: `Failed to fetch wistia metadata (HTTP ${res?.status || 500})` },
        { status: res?.status || 500 }
      );
    }

    const data = await res.json();
    const media = data?.media || {};
    
    // 3. Extract and filter mp4 video assets
    const rawAssets = media.assets || [];
    const videoAssets = rawAssets
      .filter((asset: any) => {
        // Find playable MP4 video streams
        const hasContainer = asset.container === 'mp4' || asset.ext === 'mp4';
        const isVideoType = asset.type?.toLowerCase().includes('video') || asset.type?.toLowerCase().includes('mp4') || asset.type === 'iphone_video';
        return hasContainer || isVideoType;
      })
      .map((asset: any) => {
        const height = asset.height || 0;
        const rawName = (asset.display_name || '').trim();
        const isOriginal = rawName.toLowerCase().includes('original');
        const displayName = (!isOriginal && rawName) ? rawName : (height ? `${height}p` : 'Standard');
        return {
          type: asset.type || 'mp4_video',
          slug: asset.slug || (height ? `${height}p` : 'standard'),
          displayName,
          width: asset.width || 0,
          height,
          sizeBytes: asset.size || 0,
          bitrate: asset.bitrate || 0,
          url: asset.url || '',
        };
      })
      // Sort qualities descending by height (e.g. 1080p -> 720p -> 540p -> 360p)
      .sort((a: any, b: any) => b.height - a.height);

    // Get thumbnail image
    const thumbnailAsset = rawAssets.find((asset: any) => asset.type === 'still_image' || asset.slug?.includes('still'));
    const thumbnailUrl = thumbnailAsset?.url || '';

    const videoPayload = {
      id: media.hashedId || id,
      name: media.name || 'Untitled Video',
      durationSeconds: media.duration || 0,
      thumbnailUrl,
      assets: videoAssets,
    };

    videoCache.set(id, {
      data: videoPayload,
      expiry: now + VIDEO_CACHE_TTL_MS,
    });

    return NextResponse.json({
      success: true,
      video: videoPayload,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800, max-age=3600' }
    });
  } catch (error) {
    console.error('Error fetching wistia video metadata:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
