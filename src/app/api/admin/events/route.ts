import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';
import { LaunchEvent } from '@/models/LaunchEvent';

const SUPERADMIN_EMAIL = 'fykartik@gmail.com';

export async function GET(request: Request) {
  try {
    const sessionUser = getSessionFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const cleanEmail = sessionUser.email.toLowerCase().trim();
    const isSuperadmin = cleanEmail === SUPERADMIN_EMAIL;

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    let isAdmin = isSuperadmin;
    if (!isAdmin) {
      const currentUser = await User.findOne({ email: cleanEmail }).select('role').lean();
      isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
    }

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
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
    const sessionUser = getSessionFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const cleanEmail = sessionUser.email.toLowerCase().trim();
    const isSuperadmin = cleanEmail === SUPERADMIN_EMAIL;

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    const currentUser = await User.findOne({ email: cleanEmail }).lean();
    const isAdmin = isSuperadmin || currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
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
      createdBy: cleanEmail,
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
