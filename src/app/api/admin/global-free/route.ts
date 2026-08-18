import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { isPlatformGlobalFree, setGlobalFreeDays } from '@/lib/globalSetting';

const SUPERADMIN_EMAIL = 'fykartik@gmail.com';

async function checkAdminPermission(request: Request, permKey: string) {
  const session = getSessionFromRequest(request);
  if (!session?.email) {
    return { authorized: false, status: 401, error: 'Unauthorized', email: '' };
  }

  const cleanEmail = session.email.toLowerCase().trim();
  const isSuperadmin = cleanEmail === SUPERADMIN_EMAIL;
  if (isSuperadmin) {
    return { authorized: true, status: 200, error: null, email: cleanEmail };
  }

  await connectToDatabase();
  const user = await User.findOne({ email: cleanEmail }).select('role adminPermissions').lean();

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  if (!isAdmin) {
    return { authorized: false, status: 403, error: 'Admin access required', email: cleanEmail };
  }

  const hasPerm = user?.adminPermissions?.includes(permKey) || user?.adminPermissions?.includes('*');
  if (!hasPerm) {
    return { authorized: false, status: 403, error: `Permission missing: ${permKey}`, email: cleanEmail };
  }

  return { authorized: true, status: 200, error: null, email: cleanEmail };
}

export async function GET(request: Request) {
  try {
    const auth = await checkAdminPermission(request, 'manage_global_free');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const status = await isPlatformGlobalFree();
    return NextResponse.json({ success: true, ...status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await checkAdminPermission(request, 'manage_global_free');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const days = typeof body.days === 'number' ? body.days : Number(body.days || 0);

    const result = await setGlobalFreeDays(days, auth.email);

    return NextResponse.json({
      success: true,
      message: days > 0
        ? `Platform set to FREE for everyone for ${days} day(s)!`
        : 'Global free access deactivated.',
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server Error' }, { status: 500 });
  }
}
