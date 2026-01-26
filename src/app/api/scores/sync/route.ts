import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  fetchScoresFromLiveGolfAPI,
  transformLiveGolfAPIScores,
} from '@/lib/livegolfapi';

/**
 * Sync scores from LiveGolfAPI.com for a tournament
 * SIMPLIFIED: Fetches ALL players and updates the database in bulk
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { tournamentId, liveGolfAPITournamentId } = await request.json();
    console.log(`[SYNC] 🔄 Starting sync for tournament: ${tournamentId}`);

    if (!tournamentId || !liveGolfAPITournamentId) {
      return NextResponse.json(
        { error: 'tournamentId and liveGolfAPITournamentId are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch scores from LiveGolfAPI
    const liveGolfResult = await fetchScoresFromLiveGolfAPI(liveGolfAPITournamentId);

    if (!liveGolfResult.data) {
      return NextResponse.json(
        { error: liveGolfResult.error || 'LiveGolfAPI did not return data' },
        { status: 502 }
      );
    }

    // Transform API data to our format
    const transformedScores = await transformLiveGolfAPIScores(
      liveGolfResult.data,
      supabase
    );

    if (transformedScores.length === 0) {
      return NextResponse.json(
        { error: 'No players could be processed from LiveGolfAPI' },
        { status: 400 }
      );
    }

    console.log(`[SYNC] Processing ${transformedScores.length} players...`);

    // Get all tournament_player IDs for this tournament in one query
    const { data: tournamentPlayers, error: tpError } = await supabase
      .from('tournament_players')
      .select('id, pga_player_id')
      .eq('tournament_id', tournamentId);

    if (tpError) {
      return NextResponse.json(
        { error: 'Failed to load tournament players' },
        { status: 500 }
      );
    }

    // Create a map for quick lookup
    const playerIdToTournamentPlayerId = new Map(
      tournamentPlayers?.map(tp => [tp.pga_player_id, tp.id]) || []
    );

    // Prepare bulk updates - ALL players, no limits
    const updates: Array<{
      id: string;
      total_score: number;
      today_score: number;
      thru: number | string;
      position: number | null;
      is_tied: boolean;
      tied_with_count: number;
      made_cut: boolean;
      round_1_score: number | null;
      round_2_score: number | null;
      round_3_score: number | null;
      round_4_score: number | null;
      tee_time: string | null;
      starting_tee: number | null;
      updated_at: string;
    }> = [];

    for (const score of transformedScores) {
      const tournamentPlayerId = playerIdToTournamentPlayerId.get(score.pgaPlayerId);
      if (!tournamentPlayerId) continue;

      updates.push({
        id: tournamentPlayerId,
        total_score: score.total_score,
        today_score: score.today_score,
        thru: score.thru,
        position: score.position,
        is_tied: score.is_tied,
        tied_with_count: score.tied_with_count,
        made_cut: score.made_cut,
        round_1_score: score.round_1_score,
        round_2_score: score.round_2_score,
        round_3_score: score.round_3_score,
        round_4_score: score.round_4_score,
        tee_time: score.tee_time,
        starting_tee: score.starting_tee,
        updated_at: new Date().toISOString(),
      });
    }

    // Bulk upsert all players at once using upsert
    if (updates.length > 0) {
      const { error: upsertError } = await supabase
        .from('tournament_players')
        .upsert(updates, { onConflict: 'id' });

      if (upsertError) {
        console.error('[SYNC] Bulk upsert error:', upsertError);
        return NextResponse.json(
          { error: 'Failed to update players: ' + upsertError.message },
          { status: 500 }
        );
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SYNC] ✅ Updated ${updates.length} players in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: `Synced ${updates.length} players`,
      playersUpdated: updates.length,
      source: liveGolfResult.source,
      duration: `${duration}ms`,
    });
  } catch (error: any) {
    console.error('[SYNC] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync scores' },
      { status: 500 }
    );
  }
}
