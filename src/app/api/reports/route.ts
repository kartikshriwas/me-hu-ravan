import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Report } from '@/models/Report';
import { auth } from '@/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quizId, questionId, issueType, description } = body;

    if (!quizId || !questionId || !issueType) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    await connectToDatabase();

    const report = await Report.create({
      quizId,
      questionId,
      issueType,
      description,
      userEmail: session.user.email,
    });

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
