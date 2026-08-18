import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { isPlatformGlobalFree } from '@/lib/globalSetting';
import { LaunchEvent } from '@/models/LaunchEvent';

// Server-side lightweight cache (10 second TTL) to prevent DB spamming on rapid page changes
let cachedResponse: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000;

export async function GET() {
  try {
    const now = Date.now();
    if (cachedResponse && now - lastCacheTime < CACHE_TTL_MS) {
      return NextResponse.json(cachedResponse, {
        headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=30' },
      });
    }

    await connectToDatabase();
    const { isGlobalFree, freeUntil } = await isPlatformGlobalFree();

    const activeEvent = await LaunchEvent.findOne({
      isActive: true,
      $expr: { $lt: ['$claimedCount', '$maxClaimCount'] }
    }).sort({ createdAt: -1 }).lean();

    // Clean payload without exposing internal slot/claim counts to the public
    const launchEvent = activeEvent ? {
      title: activeEvent.title,
      durationDays: activeEvent.durationDays || 365,
    } : null;

    cachedResponse = {
      success: true,
      isGlobalFree,
      globalFreeUntil: freeUntil ? new Date(freeUntil).toISOString() : null,
      launchEvent,
    };
    lastCacheTime = now;

    return NextResponse.json(cachedResponse, {
      headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=30' },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}
