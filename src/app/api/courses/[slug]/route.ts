import { NextResponse } from 'next/server';
import { getCourseBySlug } from '@/lib/coursesData';
import { getSessionFromRequest } from '@/lib/session';
import { hasCoursesAccess } from '@/lib/coursesAuth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Access Declined: Token Expired or Authentication Required' },
        { status: 401 }
      );
    }

    const { slug } = await params;
    const allowed = await hasCoursesAccess(session, slug);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Access Declined: You do not have access to this course batch' },
        { status: 403 }
      );
    }
    const course = getCourseBySlug(slug);

    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: course });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load course' }, { status: 500 });
  }
}
