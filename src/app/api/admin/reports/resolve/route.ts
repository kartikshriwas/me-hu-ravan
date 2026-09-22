import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Report } from '@/models/Report';
import { auth } from '@/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;
    
    if (role !== 'admin' && role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { reportId } = await req.json();

    if (!reportId) {
      return NextResponse.json({ success: false, error: 'Report ID is required' }, { status: 400 });
    }

    await connectToDatabase();

    const report = await Report.findByIdAndUpdate(
      reportId,
      { status: 'Resolved' },
      { new: true }
    );

    if (!report) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('Error resolving report:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
