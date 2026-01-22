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

    // Get all players that are in user rosters for this tournament (prioritize these)
    const { data: rosteredPlayers } = await supabase
      .from('roster_players')
      .select(`
        tournament_player:tournament_players!inner(
          id,
          pga_player_id
        )
      `)
      .eq('tournament_players.tournament_id', tournamentId);

    const rosteredPlayerIds = new Set(
      rosteredPlayers?.map(rp => (rp as any).tournament_player?.pga_player_id).filter(Boolean) || []
    );

    console.log(`[SYNC] Found ${rosteredPlayerIds.size} players in user rosters for this tournament`);

    // Update scores in database - prioritize rostered players
    const updates = [];
    const rosteredUpdates = [];
    const otherUpdates = [];

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
      const isRostered = rosteredPlayerIds.has(score.pgaPlayerId);

      if (isRostered) {
        rosteredUpdates.push({ score, tournamentPlayerId });
      } else {
        otherUpdates.push({ score, tournamentPlayerId });
      }
    }

    // Process rostered players first (higher priority) - in parallel batches
    console.log(`[SYNC] Processing ${rosteredUpdates.length} rostered players first...`);

    if (rosteredUpdates.length > 0) {
      const batchSize = 10; // Process in smaller batches to avoid overwhelming the database
      for (let i = 0; i < rosteredUpdates.length; i += batchSize) {
        const batch = rosteredUpdates.slice(i, i + batchSize);
        const batchPromises = batch.map(async ({ score, tournamentPlayerId }) => {
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
            return null;
          }

          return {
            id: tournamentPlayerId,
            pgaPlayerId: score.pgaPlayerId,
            playerName: score.playerName,
          };
        });

        const batchResults = await Promise.all(batchPromises);
        updates.push(...batchResults.filter(Boolean));
      }
    }

    // Skip other players to avoid timeout - only update rostered players
    if (otherUpdates.length > 0) {
      console.log(`[SYNC] Skipping ${otherUpdates.length} non-rostered players to avoid timeout`);
    }

    // Skip automatic calculations during sync to avoid timeouts on Vercel
    // These can be run separately via cron jobs or manual triggers
    console.log(`[SYNC] Skipping automatic calculations to complete within timeout limits`);
    console.log(`[SYNC] Run calculate-winnings and calculate APIs separately if needed`);

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
