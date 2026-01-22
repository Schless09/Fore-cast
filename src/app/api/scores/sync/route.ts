import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  fetchScoresFromLiveGolfAPI,
  transformLiveGolfAPIScores,
} from '@/lib/livegolfapi';

/**
 * Sync scores from LiveGolfAPI.com for a tournament
 * This endpoint fetches live scores and updates the database
 */
export async function POST(request: NextRequest) {
  try {
    const { tournamentId, liveGolfAPITournamentId } = await request.json();

    if (!tournamentId || !liveGolfAPITournamentId) {
      return NextResponse.json(
        {
          error:
            'tournamentId and liveGolfAPITournamentId are required',
        },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch scores from LiveGolfAPI
    const liveGolfResult = await fetchScoresFromLiveGolfAPI(
      liveGolfAPITournamentId
    );

    if (!liveGolfResult.data) {
      return NextResponse.json(
        {
          error:
            liveGolfResult.error || 'LiveGolfAPI did not return scoreboard data',
        },
        { status: 502 }
      );
    }

    const scorecards = liveGolfResult.data;

    // Get mapping of player names to our pga_player_ids
    const { data: tournamentPlayers, error: tpError } = await supabase
      .from('tournament_players')
      .select('id, pga_player_id, pga_players(name)')
      .eq('tournament_id', tournamentId);

    if (tpError) {
      return NextResponse.json(
        { error: 'Failed to load tournament players' },
        { status: 500 }
      );
    }

    // Create a map from player name (lowercase) to pga_player_id
    const playerNameMap = new Map<string, string>();
    tournamentPlayers?.forEach((tp: any) => {
      if (tp.pga_players?.name) {
        playerNameMap.set(tp.pga_players.name.toLowerCase().trim(), tp.pga_player_id);
      }
    });

    // Transform LiveGolfAPI scores
    const transformedScores = transformLiveGolfAPIScores(
      scorecards,
      playerNameMap
    );

    if (transformedScores.length === 0) {
      return NextResponse.json(
        {
          error: 'No matching players found. Ensure player names match.',
          warning: 'You may need to update player names or add a player ID mapping',
        },
        { status: 400 }
      );
    }

    // Update scores in database
    const updates = [];
    for (const score of transformedScores) {
      // Find tournament_player record
      const { data: tournamentPlayer, error: findError } = await supabase
        .from('tournament_players')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('pga_player_id', score.pgaPlayerId)
        .single();

      if (findError || !tournamentPlayer) {
        console.error(
          `Tournament player not found for pgaPlayerId: ${score.pgaPlayerId}`
        );
        continue;
      }

      // Update tournament player scores
      const { error: updateError } = await supabase
        .from('tournament_players')
        .update({
          total_score: score.total_score,
          today_score: score.today_score,
          thru: score.thru,
          position: score.position,
          made_cut: score.made_cut,
          round_1_score: score.round_1_score || null,
          round_2_score: score.round_2_score || null,
          round_3_score: score.round_3_score || null,
          round_4_score: score.round_4_score || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tournamentPlayer.id);

      if (updateError) {
        console.error('Error updating tournament player:', updateError);
        continue;
      }

      updates.push(score.pgaPlayerId);
    }

    // Trigger fantasy points recalculation
    try {
      const recalcResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/scores/calculate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournamentId }),
        }
      );
    } catch (recalcError) {
      console.error('Error triggering recalculation:', recalcError);
    }

    // Note: After tournament completion, call /api/scores/calculate-winnings
    // to calculate prize money based on final positions

    return NextResponse.json({
      success: true,
      message: `Synced scores for ${updates.length} players from LiveGolfAPI`,
      updatedPlayers: updates,
    });
  } catch (error: any) {
    console.error('Error syncing scores:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync scores' },
      { status: 500 }
    );
  }
}
