import { NextRequest, NextResponse } from 'next/server';

/**
 * RapidAPI Daily Cron — runs once per day (e.g. 6 AM UTC)
 *
 * Calls auto-sync with source=rapidapi-daily to run RapidAPI logic:
 * - Leaderboard for active tournaments
 * - Mark completed, sync final scores, calculate winnings
 *
 * Tee times: CBS only, via check-withdrawals cron (Tue–Thu).
 * ESPN sync (espn-sync) runs every 2 min for live scores; RapidAPI is used
 * only for official wrap-up and event transitions.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isDev = process.env.NODE_ENV === 'development';
    const isAuthorized = !cronSecret || authHeader === `Bearer ${cronSecret}` || isDev;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/scores/auto-sync?force=true&source=rapidapi-daily`;
    const res = await fetch(url, {
      headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      cache: 'no-store',
    });

    const json = await res.json().catch(() => ({}));
    return NextResponse.json({
      success: res.ok,
      message: 'RapidAPI daily sync triggered',
      autoSyncResponse: json,
      status: res.status,
    });
  } catch (error) {
    console.error('[RAPIDAPI-DAILY] Error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger RapidAPI daily sync', success: false },
      { status: 500 }
    );
  }
}
