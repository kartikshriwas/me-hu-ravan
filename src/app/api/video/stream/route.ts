import { NextRequest, NextResponse } from 'next/server';
import { verifyStreamTicket } from '@/lib/videoStreamToken';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticket = searchParams.get('ticket');

    if (!ticket) {
      return new Response(JSON.stringify({ error: 'Missing stream authorization' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Anti-Scraping / Anti-Direct-Download:
    // When a user pastes a link into the browser address bar or tries to trigger a browser file download,
    // modern browsers set Sec-Fetch-Dest to 'document' and Sec-Fetch-Mode to 'navigate'.
    // Legitimate video player / media requests send Sec-Fetch-Dest: 'video' or 'empty'.
    const secFetchDest = request.headers.get('sec-fetch-dest');
    const secFetchMode = request.headers.get('sec-fetch-mode');
    if (secFetchDest === 'document' || secFetchMode === 'navigate') {
      return new Response('Direct video file download is prohibited.', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-store',
        },
      });
    }

    // Verify cryptographic signature and expiration in ~1ms
    const verified = await verifyStreamTicket(ticket);
    if (!verified || !verified.targetUrl) {
      return new Response(JSON.stringify({ error: 'Invalid or expired stream ticket' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Host validation: ensure target belongs to allowed CDN origin
    try {
      const parsedHost = new URL(verified.targetUrl).hostname.toLowerCase();
      const isAllowed =
        parsedHost.endsWith('wistia.com') ||
        parsedHost.endsWith('wistia.net') ||
        parsedHost.includes('wistia') ||
        parsedHost.endsWith('cloudfront.net');
      if (!isAllowed) {
        return new Response('Invalid stream target host', { status: 403 });
      }
    } catch {
      return new Response('Invalid stream URL', { status: 400 });
    }

    // Option 2: Instant HTTP 307 Temporary Redirect directly to Wistia's Cloudfront CDN
    // - Function executes in ~2-5 milliseconds (0 Fluid Active CPU)
    // - 0 video bytes flow through Vercel Functions (0 Vercel Fast Data Transfer / Bandwidth charges)
    // - The browser follows the redirect and streams range chunks directly from origin CDN
    return NextResponse.redirect(verified.targetUrl, {
      status: 307,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('Error handling video stream request:', error);
    return new Response('Internal Stream Error', { status: 500 });
  }
}
