import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Report } from '@/models/Report';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;
    
    if (role !== 'admin' && role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const reports = await Report.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({ success: true, reports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
