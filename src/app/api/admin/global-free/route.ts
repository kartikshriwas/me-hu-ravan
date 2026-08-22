import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { verifyAdminPermission } from '@/lib/adminAuth';
import { isPlatformGlobalFree, setGlobalFreeDays } from '@/lib/globalSetting';

export async function GET(request: Request) {
  try {
    const sessionUser = getSessionFromRequest(request);
    const auth = await verifyAdminPermission(sessionUser?.email, 'manage_global_free');
    if (!auth.isAuthorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode || 403 });
    }

    const status = await isPlatformGlobalFree();
    return NextResponse.json({ success: true, ...status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = getSessionFromRequest(request);
    const auth = await verifyAdminPermission(sessionUser?.email, 'manage_global_free');
    if (!auth.isAuthorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode || 403 });
    }

    const body = await request.json();
    const days = typeof body.days === 'number' ? body.days : Number(body.days || 0);

    const result = await setGlobalFreeDays(days, sessionUser!.email.toLowerCase().trim());

    return NextResponse.json({
      success: true,
      message: days > 0
        ? `Platform set to FREE for everyone for ${days} day(s)!`
        : 'Global free access deactivated.',
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Server Error' }, { status: 500 });
  }
}
