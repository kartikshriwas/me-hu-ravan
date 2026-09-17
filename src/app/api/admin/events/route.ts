import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyAdminPermission } from '@/lib/adminAuth';
import { LaunchEvent } from '@/models/LaunchEvent';

export async function GET(request: Request) {
  try {
    const session = await auth();
  const sessionUser = session?.user as any;
    const adminAuth = await verifyAdminPermission(sessionUser?.email, 'manage_events');
    if (!adminAuth.isAuthorized) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.statusCode || 403 });
    }

    const events = await LaunchEvent.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      events: events.map((e) => ({
        id: e._id.toString(),
        title: e.title,
        maxClaimCount: e.maxClaimCount,
        claimedCount: e.claimedCount,
        durationDays: e.durationDays,
        isActive: e.isActive,
        claimedUsers: e.claimedUsers || [],
        createdBy: e.createdBy,
        createdAt: new Date(e.createdAt).toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching admin events:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
  const sessionUser = session?.user as any;
    const adminAuth = await verifyAdminPermission(sessionUser?.email, 'manage_events');
    if (!adminAuth.isAuthorized) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.statusCode || 403 });
    }

    const body = await request.json();
    const { eventId, action, title, maxClaimCount = 100, durationDays = 365, isActive = true } = body;

    if (action === 'toggle' && eventId) {
      const event = await LaunchEvent.findById(eventId);
      if (!event) {
        return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
      }
      event.isActive = !event.isActive;
      await event.save();
      return NextResponse.json({
        success: true,
        message: `Event "${event.title}" is now ${event.isActive ? 'Active' : 'Paused'}.`,
      });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Event title is required' }, { status: 400 });
    }

    const newEvent = await LaunchEvent.create({
      title: title.trim(),
      maxClaimCount: parseInt(maxClaimCount) || 100,
      claimedCount: 0,
      durationDays: parseInt(durationDays) || 365,
      isActive: Boolean(isActive),
      claimedUsers: [],
      createdBy: sessionUser!.email.toLowerCase().trim(),
    });

    return NextResponse.json({
      success: true,
      message: `Launch Event "${newEvent.title}" created successfully!`,
      event: newEvent,
    });
  } catch (error) {
    console.error('Error creating admin event:', error);
    return NextResponse.json({ success: false, error: 'Failed to create event' }, { status: 500 });
  }
}
