import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyAdminPermission } from '@/lib/adminAuth';
import { getAutoDemoConfig, setAutoDemoConfig } from '@/lib/globalSetting';

export async function GET(request: Request) {
  try {
    const session = await auth();
    const sessionUser = session?.user as any;
    const adminAuth = await verifyAdminPermission(sessionUser?.email, 'manage_global_free');
    if (!adminAuth.isAuthorized) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.statusCode || 403 });
    }

    const config = await getAutoDemoConfig();
    return NextResponse.json({ success: true, ...config });
  } catch (err: any) {
    console.error('Error in auto-demo GET:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch auto-demo config' }, { status: 500 });
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
    const enabled = Boolean(body.autoDemoEnabled);
    const durationMinutes = Math.max(1, parseInt(body.autoDemoDurationMinutes) || 15);

    const result = await setAutoDemoConfig(enabled, durationMinutes, sessionUser!.email.toLowerCase().trim());

    return NextResponse.json({
      success: true,
      message: enabled
        ? `Auto demo for new users ENABLED (${durationMinutes} minutes duration)!`
        : 'Auto demo for new users DEACTIVATED.',
      ...result,
    });
  } catch (err: any) {
    console.error('Error in auto-demo POST:', err);
    return NextResponse.json({ success: false, error: 'Failed to update auto-demo settings' }, { status: 500 });
  }
}
