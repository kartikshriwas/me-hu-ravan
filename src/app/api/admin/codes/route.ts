import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { verifyAdminPermission } from '@/lib/adminAuth';
import { RedeemCode } from '@/models/RedeemCode';

function generateRandomCode(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let random1 = '';
  let random2 = '';
  for (let i = 0; i < 4; i++) {
    random1 += chars.charAt(Math.floor(Math.random() * chars.length));
    random2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const cleanPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const prefixPart = cleanPrefix ? (cleanPrefix.endsWith('-') ? cleanPrefix : `${cleanPrefix}-`) : 'PREPTEA-';
  return `${prefixPart}${random1}-${random2}`;
}

export async function GET(request: Request) {
  try {
    const sessionUser = getSessionFromRequest(request);
    const auth = await verifyAdminPermission(sessionUser?.email, 'manage_codes');
    if (!auth.isAuthorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode || 403 });
    }

    const codes = await RedeemCode.find().sort({ createdAt: -1 }).limit(200).lean();

    return NextResponse.json({
      success: true,
      codes: codes.map((c) => ({
        id: c._id.toString(),
        code: c.code,
        durationDays: c.durationDays,
        maxUses: c.maxUses,
        usedCount: c.usedCount,
        usedBy: c.usedBy || [],
        expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
        createdBy: c.createdBy,
        batchName: c.batchName || 'General',
        isActive: c.isActive,
        createdAt: new Date(c.createdAt).toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching admin codes:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch redeem codes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = getSessionFromRequest(request);
    const auth = await verifyAdminPermission(sessionUser?.email, 'manage_codes');
    if (!auth.isAuthorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode || 403 });
    }

    const body = await request.json();
    const { count = 1, durationDays = 365, maxUses = 1, prefix = 'PREPTEA', batchName = 'General', expiresDays } = body;

    const numCount = Math.min(Math.max(parseInt(count) || 1, 1), 100);
    const numDuration = parseInt(durationDays) || 365;
    const numMaxUses = parseInt(maxUses) || 1;

    let expiresAt: Date | null = null;
    if (expiresDays && parseInt(expiresDays) > 0) {
      expiresAt = new Date(Date.now() + parseInt(expiresDays) * 24 * 60 * 60 * 1000);
    }

    const createdCodes: string[] = [];

    for (let i = 0; i < numCount; i++) {
      let uniqueCode = generateRandomCode(prefix);
      let attempts = 0;
      while ((await RedeemCode.exists({ code: uniqueCode })) && attempts < 10) {
        uniqueCode = generateRandomCode(prefix);
        attempts++;
      }

      await RedeemCode.create({
        code: uniqueCode,
        durationDays: numDuration,
        maxUses: numMaxUses,
        usedCount: 0,
        usedBy: [],
        expiresAt,
        createdBy: sessionUser!.email.toLowerCase().trim(),
        batchName: batchName || 'General',
        isActive: true,
      });

      createdCodes.push(uniqueCode);
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${createdCodes.length} redeem codes successfully!`,
      codes: createdCodes,
    });
  } catch (error) {
    console.error('Error generating codes:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate codes' }, { status: 500 });
  }
}
