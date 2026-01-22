import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { generateCostFromOddsData } from '@/lib/salary-cap';

/**
 * Bulk update player odds and calculate costs
 * Expected payload: { tournamentId, players: [{ playerName, winnerOdds, top5Odds, top10Odds }] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { tournamentId, players } = body;

    if (!tournamentId || !players || !Array.isArray(players)) {
      return NextResponse.json(
        { error: 'tournamentId and players array are required' },
        { status: 400 }
      );
    }

    const updates = [];

    for (const player of players) {
      const { playerName, winnerOdds, top5Odds, top10Odds } = player;

      // Find or create player by name (case-insensitive)
      let { data: pgaPlayers, error: playerError } = await supabase
        .from('pga_players')
        .select('id')
        .ilike('name', playerName)
        .limit(1);

      let pgaPlayerId: string;

      if (playerError || !pgaPlayers || pgaPlayers.length === 0) {
        // Player doesn't exist, create it
        const { data: newPlayer, error: createPlayerError } = await supabase
          .from('pga_players')
          .insert({
            name: playerName.trim(),
            is_active: true,
          })
          .select('id')
          .single();

        if (createPlayerError || !newPlayer) {
          console.error(`Failed to create player ${playerName}:`, createPlayerError);
          continue;
        }

        pgaPlayerId = newPlayer.id;
        console.log(`Created new player: ${playerName}`);
      } else {
        pgaPlayerId = pgaPlayers[0].id;
      }

      // Find tournament_player record
      const { data: tournamentPlayer, error: findError } = await supabase
        .from('tournament_players')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('pga_player_id', pgaPlayerId)
        .single();

      if (findError || !tournamentPlayer) {
        // Create tournament_player if it doesn't exist
        const { data: newTournamentPlayer, error: createError } = await supabase
          .from('tournament_players')
          .insert({
            tournament_id: tournamentId,
            pga_player_id: pgaPlayerId,
            winner_odds: winnerOdds,
            top5_odds: top5Odds,
            top10_odds: top10Odds,
            cost: generateCostFromOddsData(winnerOdds),
          })
          .select()
          .single();

        if (createError) {
          console.error(`Error creating tournament player for ${playerName}:`, createError);
          continue;
        }

        updates.push(playerName);
        continue;
      }

      // Calculate cost from odds
      const cost = generateCostFromOddsData(winnerOdds);

      // Update tournament player with odds and cost
      const { error: updateError } = await supabase
        .from('tournament_players')
        .update({
          winner_odds: winnerOdds,
          top5_odds: top5Odds,
          top10_odds: top10Odds,
          cost: cost,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tournamentPlayer.id);

      if (updateError) {
        console.error(`Error updating tournament player for ${playerName}:`, updateError);
        continue;
      }

      updates.push(playerName);
    }

    return NextResponse.json({
      success: true,
      message: `Updated odds and costs for ${updates.length} players`,
      updatedPlayers: updates,
    });
  } catch (error: any) {
    console.error('Error updating odds:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update odds' },
      { status: 500 }
    );
  }
}
