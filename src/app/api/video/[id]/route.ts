import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Session verification
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid Video ID' }, { status: 400 });
    }

    // 2. Fetch Wistia metadata from their API
    const wistiaUrl = `https://fast.wistia.com/embed/medias/${id}.json`;
    const res = await fetch(wistiaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch wistia metadata (HTTP ${res.status})` },
        { status: res.status }
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
      .map((asset: any) => ({
        type: asset.type || 'mp4_video',
        slug: asset.slug || '',
        displayName: asset.display_name || 'Standard',
        width: asset.width || 0,
        height: asset.height || 0,
        sizeBytes: asset.size || 0,
        bitrate: asset.bitrate || 0,
        url: asset.url || '',
      }))
      // Sort qualities descending by height (e.g. 1080p -> 720p -> 540p -> 360p)
      .sort((a: any, b: any) => b.height - a.height);

    // Get thumbnail image
    const thumbnailAsset = rawAssets.find((asset: any) => asset.type === 'still_image' || asset.slug?.includes('still'));
    const thumbnailUrl = thumbnailAsset?.url || '';

    return NextResponse.json({
      success: true,
      video: {
        id: media.hashedId || id,
        name: media.name || 'Untitled Video',
        durationSeconds: media.duration || 0,
        thumbnailUrl,
        assets: videoAssets,
      },
    });
  } catch (error) {
    console.error('Error fetching wistia video metadata:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
