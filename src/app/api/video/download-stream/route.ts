import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasCoursesAccess } from '@/lib/coursesAuth';

export const dynamic = 'force-dynamic';

function isAllowedVideoHost(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith('wistia.com') ||
      host.endsWith('wistia.net') ||
      host.includes('wistia') ||
      host.endsWith('cloudfront.net')
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Session check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    // 2. Course access verification
    const hasAccess = await hasCoursesAccess(session.user as any);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl || !isAllowedVideoHost(targetUrl)) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const clientRange = request.headers.get('range');
    const upstreamHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: '*/*',
    };
    if (clientRange) {
      upstreamHeaders['Range'] = clientRange;
    }

    // 2. Fetch the video stream from remote CDN
    const upstreamRes = await fetch(targetUrl, {
      headers: upstreamHeaders,
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      return NextResponse.json(
        { error: `Upstream error: HTTP ${upstreamRes.status}` },
        { status: upstreamRes.status || 502 }
      );
    }

    // 3. Forward stream to client
    const headers = new Headers();
    headers.set('Content-Type', upstreamRes.headers.get('content-type') || 'video/mp4');
    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }
    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) {
      headers.set('Content-Range', contentRange);
    }
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    headers.set('Content-Disposition', 'inline'); // Explicitly inline, NOT attachment

    return new Response(upstreamRes.body as any, {
      status: upstreamRes.status === 206 ? 206 : 200,
      headers,
    });
  } catch (error: any) {
    console.error('Error proxying video download stream:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
