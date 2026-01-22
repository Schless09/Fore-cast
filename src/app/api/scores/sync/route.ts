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

    // Create a map from player name (lowercase and normalized) to pga_player_id
    const playerNameMap = new Map<string, string>();
    tournamentPlayers?.forEach((tp: any) => {
      if (tp.pga_players?.name) {
        const name = tp.pga_players.name;
        // Add both original and normalized versions
        playerNameMap.set(name.toLowerCase().trim(), tp.pga_player_id);
        
        // Also add normalized version (without accents)
        const normalized = name
          .toLowerCase()
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        playerNameMap.set(normalized, tp.pga_player_id);
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

    // Log how many players have tee time strings
    const playersWithTeeTimes = transformedScores.filter(s => typeof s.thru === 'string' && s.thru.includes('PM'));
    console.log(`\n[TRANSFORM RESULT] Total transformed: ${transformedScores.length}, With tee times: ${playersWithTeeTimes.length}`);
    if (playersWithTeeTimes.length > 0) {
      console.log(`[TRANSFORM RESULT] First 3 players with tee times:`, playersWithTeeTimes.slice(0, 3).map(p => ({
        id: p.pgaPlayerId.substring(0, 8),
        position: p.position,
        thru: p.thru,
        thru_type: typeof p.thru,
      })));
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
        console.log(
          `[SYNC SKIP] Player not in database - pgaPlayerId: ${score.pgaPlayerId.substring(0, 8)}, position: ${score.position}, thru: ${score.thru} (${typeof score.thru})`
        );
        continue;
      }

      // Log what we're about to store (first 3 players + any with tee time strings)
      if (updates.length < 3 || (typeof score.thru === 'string' && score.thru.includes('PM'))) {
        console.log(`\n[SYNC] Updating player:`, {
          name: score.pgaPlayerId.substring(0, 8),
          position: score.position,
          total_score: score.total_score,
          today_score: score.today_score,
          thru: score.thru,
          thru_type: typeof score.thru,
        });
      }

      // Update tournament player scores and tee times
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
          tee_time: score.tee_time || null,
          starting_tee: score.starting_tee || null,
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

    // Check if tournament is active and has prize money distribution
    // If so, automatically calculate prize money for real-time updates
    try {
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('status')
        .eq('id', tournamentId)
        .single();

      if (!tournamentError && tournament?.status === 'active') {
        // Check if prize money distribution exists
        const { data: prizeDistributions } = await supabase
          .from('prize_money_distributions')
          .select('id')
          .eq('tournament_id', tournamentId)
          .limit(1);

        if (prizeDistributions && prizeDistributions.length > 0) {
          console.log(`[PRIZE MONEY] Tournament ${tournamentId} is active with prize distribution - calculating real-time winnings`);

          const winningsResponse = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/scores/calculate-winnings`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tournamentId }),
            }
          );

          if (!winningsResponse.ok) {
            console.error('Error calculating prize money:', await winningsResponse.text());
          } else {
            console.log(`[PRIZE MONEY] Successfully updated prize money for tournament ${tournamentId}`);
          }
        }
      }
    } catch (winningsError) {
      console.error('Error triggering prize money calculation:', winningsError);
    }

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
