import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasCoursesAccess } from '@/lib/coursesAuth';
import { checkCanDownload } from '@/lib/batchAccess';
import { createStreamTicket } from '@/lib/videoStreamToken';

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

    // 2. Permission check: Download is premium-only, NOT available for demo or free
    const sessionUser = session.user as any;
    if (!checkCanDownload(sessionUser)) {
      return NextResponse.json({ error: 'Downloads are reserved for premium batch members' }, { status: 403 });
    }

    // 3. Course access verification
    const hasAccess = await hasCoursesAccess(sessionUser);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl || !isAllowedVideoHost(targetUrl)) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    // Direct 307 redirect to origin CDN (execution duration ~5ms, zero Vercel video bytes)
    return NextResponse.redirect(targetUrl, {
      status: 307,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error: any) {
    console.error('Error in download stream redirect:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
