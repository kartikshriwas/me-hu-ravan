import { NextResponse } from 'next/server';
import { getAllCourses } from '@/lib/coursesData';
import { auth } from '@/auth';
import { hasCoursesAccess } from '@/lib/coursesAuth';

export async function GET(request: Request) {
  try {
    const sessionAuth = await auth();
    const session = sessionAuth?.user as any;
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Access Declined: Token Expired or Authentication Required' },
        { status: 401 }
      );
    }

    const allowed = await hasCoursesAccess(session);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Access Declined: Course catalog access permission required' },
        { status: 403 }
      );
    }

    const courses = getAllCourses();
    return NextResponse.json(
      { success: true, data: courses },
      { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600' } }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch courses' }, { status: 500 });
  }
}
