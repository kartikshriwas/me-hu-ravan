import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ success: true, message: 'Auth endpoint active' });
}

export async function POST() {
  return NextResponse.json({ success: true, message: 'Auth endpoint active' });
}
