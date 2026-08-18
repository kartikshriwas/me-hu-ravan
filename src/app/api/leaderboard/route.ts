import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models/User';

let cachedLeaderboard: any = null;
let lastLeaderboardFetch = 0;
const LEADERBOARD_CACHE_TTL_MS = 30000; // 30-second in-memory cache

export async function GET() {
  try {
    const now = Date.now();
    if (cachedLeaderboard && now - lastLeaderboardFetch < LEADERBOARD_CACHE_TTL_MS) {
      return NextResponse.json({ success: true, data: cachedLeaderboard, cached: true });
    }

    const conn = await connectToDatabase();

    if (!conn || conn.connection.readyState !== 1) {
      return NextResponse.json({
        success: true,
        data: cachedLeaderboard || []
      });
    }

    // Query top users by totalScore
    const users = await User.find({ totalScore: { $gt: 0 } })
      .select('name email image totalScore testsCompleted averageAccuracy')
      .sort({ totalScore: -1, averageAccuracy: -1 })
      .limit(50)
      .lean();

    const leaderboard = users.map((u, idx) => {
      // Mask email for privacy (e.g. k***k@gmail.com)
      let maskedEmail = '';
      if (u.email) {
        const [local, domain] = u.email.split('@');
        if (local && domain) {
          maskedEmail = `${local[0]}***${local[local.length - 1]}@${domain}`;
        }
      }

      return {
        rank: idx + 1,
        id: u._id.toString(),
        name: u.name || 'Candidate',
        email: maskedEmail,
        image: u.image || '',
        totalScore: u.totalScore || 0,
        testsCompleted: u.testsCompleted || 0,
        averageAccuracy: Math.round(u.averageAccuracy || 0),
      };
    });

    cachedLeaderboard = leaderboard;
    lastLeaderboardFetch = now;

    return NextResponse.json({ success: true, data: leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ success: true, data: cachedLeaderboard || [] });
  }
}
