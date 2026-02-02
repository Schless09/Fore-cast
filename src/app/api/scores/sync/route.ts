import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { syncTournamentScores } from '@/lib/sync-scores';

/**
 * Sync scores from LiveGolfAPI.com for a tournament
 * Fetches ALL players and updates the database in bulk
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { tournamentId, liveGolfAPITournamentId } = await request.json();

    if (!tournamentId || !liveGolfAPITournamentId) {
      return NextResponse.json(
        { error: 'tournamentId and liveGolfAPITournamentId are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const result = await syncTournamentScores(supabase, tournamentId, liveGolfAPITournamentId);

    const duration = Date.now() - startTime;

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: result.error === 'NO_API_DATA' ? 502 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      playersUpdated: result.playersUpdated,
      source: result.source,
      duration: `${duration}ms`,
    });
  } catch (error: unknown) {
    console.error('[SYNC] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync scores' },
      { status: 500 }
    );
  }
}
