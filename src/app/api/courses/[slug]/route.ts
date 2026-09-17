import { NextResponse } from 'next/server';
import { getCourseBySlug } from '@/lib/coursesData';
import { auth } from '@/auth';
import { hasCoursesAccess } from '@/lib/coursesAuth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
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
        { success: false, error: 'Course catalog access denied' },
        { status: 404 }
      );
    }
    const { slug } = await params;
    const course = getCourseBySlug(slug);

    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: course });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load course' }, { status: 500 });
  }
}
