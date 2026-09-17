import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyAdminPermission } from '@/lib/adminAuth';
import { isPlatformGlobalFree, setGlobalFreeDays } from '@/lib/globalSetting';

export async function GET(request: Request) {
  try {
    const session = await auth();
  const sessionUser = session?.user as any;
    const adminAuth = await verifyAdminPermission(sessionUser?.email, 'manage_global_free');
    if (!adminAuth.isAuthorized) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.statusCode || 403 });
    }

    const status = await isPlatformGlobalFree();
    return NextResponse.json({ success: true, ...status });
  } catch (err: any) {
    console.error('Error in global-free GET:', err);
    return NextResponse.json({ success: false, error: 'Failed to check global free status' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
  const sessionUser = session?.user as any;
    const adminAuth = await verifyAdminPermission(sessionUser?.email, 'manage_global_free');
    if (!adminAuth.isAuthorized) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.statusCode || 403 });
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
    console.error('Error in global-free POST:', err);
    return NextResponse.json({ success: false, error: 'Failed to update global free status' }, { status: 500 });
  }
}
