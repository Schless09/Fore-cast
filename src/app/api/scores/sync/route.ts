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
    console.log(`[SYNC API] 🔄 Starting sync for tournament: ${tournamentId}, API event: ${liveGolfAPITournamentId}`);

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

    // Get existing tournament players to avoid duplicates
    const { data: existingTournamentPlayers, error: tpError } = await supabase
      .from('tournament_players')
      .select('pga_player_id')
      .eq('tournament_id', tournamentId);

    if (tpError) {
      return NextResponse.json(
        { error: 'Failed to load tournament players' },
        { status: 500 }
      );
    }

    const existingPlayerIds = new Set(
      existingTournamentPlayers?.map(tp => tp.pga_player_id) || []
    );

    // Transform LiveGolfAPI scores (creates players automatically)
    const transformedScores = await transformLiveGolfAPIScores(
      scorecards,
      supabase
    );

    if (transformedScores.length === 0) {
      return NextResponse.json(
        {
          error: 'No players could be processed from LiveGolfAPI.',
          warning: 'Check the API response and database connection',
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
      // Check if tournament_player record exists
      const { data: existingTournamentPlayer } = await supabase
        .from('tournament_players')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('pga_player_id', score.pgaPlayerId)
        .single();

      if (!existingTournamentPlayer) {
                  // Skip players that aren't in this tournament
                  console.log(`[SYNC] Skipping player not in tournament: ${score.playerName} (clean: ${score.playerName.replace(/\s*\([^)]+\)\s*$/, '').trim()})`);
                  continue;
      }

      const tournamentPlayerId = existingTournamentPlayer.id;

      // Log what we're about to store (first 3 players + any with tee time strings)
      if (updates.length < 3 || (typeof score.thru === 'string' && score.thru.includes('PM'))) {
        console.log(`\n[SYNC] Updating player: ${score.playerName}`, {
          position: score.position,
          total_score: score.total_score,
          today_score: score.today_score,
          thru: score.thru,
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
        .eq('id', tournamentPlayerId);

      if (updateError) {
        console.error('Error updating tournament player:', updateError);
        continue;
      }

      updates.push({
        id: tournamentPlayerId,
        pgaPlayerId: score.pgaPlayerId,
        playerName: score.playerName,
      });
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
