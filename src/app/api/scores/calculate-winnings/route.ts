import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  calculatePlayerPrizeMoney,
  detectTies,
  parsePrizeMoneyTable,
} from '@/lib/prize-money';

/**
 * Calculate prize money for all players in a tournament based on their final positions
 * This handles ties by splitting prize money appropriately
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { tournamentId } = await request.json();

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      );
    }

    // Get prize money distribution for this tournament
    const { data: prizeDistributions, error: prizeError } = await supabase
      .from('prize_money_distributions')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('position', { ascending: true });

    if (prizeError || !prizeDistributions || prizeDistributions.length === 0) {
      return NextResponse.json(
        {
          error:
            'Prize money distribution not found for this tournament. Please import it first.',
        },
        { status: 400 }
      );
    }

    const totalPurse = prizeDistributions[0].total_purse;
    const prizeStructure = parsePrizeMoneyTable(
      tournamentId,
      totalPurse,
      prizeDistributions.map((d: any) => ({
        position: d.position,
        percentage: d.percentage,
        amount: parseFloat(d.amount),
        // Include pre-calculated tie amounts if available
        tied_2: d.tied_2 ? parseFloat(d.tied_2) : undefined,
        tied_3: d.tied_3 ? parseFloat(d.tied_3) : undefined,
        tied_4: d.tied_4 ? parseFloat(d.tied_4) : undefined,
        tied_5: d.tied_5 ? parseFloat(d.tied_5) : undefined,
        tied_6: d.tied_6 ? parseFloat(d.tied_6) : undefined,
        tied_7: d.tied_7 ? parseFloat(d.tied_7) : undefined,
        tied_8: d.tied_8 ? parseFloat(d.tied_8) : undefined,
        tied_9: d.tied_9 ? parseFloat(d.tied_9) : undefined,
        tied_10: d.tied_10 ? parseFloat(d.tied_10) : undefined,
      }))
    );

    // Get all tournament players with their final positions
    const { data: tournamentPlayers, error: tpError } = await supabase
      .from('tournament_players')
      .select('id, position, made_cut')
      .eq('tournament_id', tournamentId);

    console.log(`[PRIZE MONEY] Found ${tournamentPlayers?.length || 0} tournament players`);
    if (tournamentPlayers && tournamentPlayers.length > 0) {
      console.log(`[PRIZE MONEY] Sample players:`, tournamentPlayers.slice(0, 3).map(p => ({ id: p.id, position: p.position })));
    }

    if (tpError) {
      return NextResponse.json(
        { error: 'Failed to load tournament players' },
        { status: 500 }
      );
    }

    // Detect ties
    const ties = detectTies(tournamentPlayers || []);

    // Calculate prize money for each player
    const updates = (tournamentPlayers || []).map((tp: any) => {
      const position = tp.position;
      const isTied = ties.has(position || 0);
      const tiedCount = isTied ? ties.get(position || 0) || 1 : 1;

      const prizeMoney = calculatePlayerPrizeMoney(
        position,
        isTied,
        tiedCount,
        prizeStructure
      );

      return {
        id: tp.id,
        prize_money: prizeMoney,
        is_tied: isTied,
        tied_with_count: tiedCount,
      };
    });

    // Update tournament players with prize money
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('tournament_players')
        .update({
          prize_money: update.prize_money,
          is_tied: update.is_tied,
          tied_with_count: update.tied_with_count,
        })
        .eq('id', update.id);

      if (updateError) {
        console.error('Error updating tournament player:', updateError);
      }
    }

    // Update roster_players with player winnings
    const { data: rosterPlayers, error: rpError } = await supabase
      .from('roster_players')
      .select('id, tournament_player_id, tournament_players(prize_money)')
      .in(
        'tournament_player_id',
        updates.map((u) => u.id)
      );

    if (!rpError && rosterPlayers) {
      for (const rp of rosterPlayers) {
        const prizeMoney =
          (rp.tournament_players as any)?.prize_money || 0;

        await supabase
          .from('roster_players')
          .update({ player_winnings: prizeMoney })
          .eq('id', rp.id);
      }
    }

    // Recalculate total winnings for all rosters in this tournament
    const { data: rosters, error: rostersError } = await supabase
      .from('user_rosters')
      .select('id, roster_players(player_winnings)')
      .eq('tournament_id', tournamentId);

    if (!rostersError && rosters) {
      for (const roster of rosters) {
        const totalWinnings =
          (roster.roster_players as any[])?.reduce(
            (sum: number, rp: any) => sum + (rp.player_winnings || 0),
            0
          ) || 0;

        await supabase
          .from('user_rosters')
          .update({ total_winnings: totalWinnings })
          .eq('id', roster.id);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Calculated prize money for ${updates.length} players`,
      totalPurse: totalPurse,
    });
  } catch (error: any) {
    console.error('Error calculating winnings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate winnings' },
      { status: 500 }
    );
  }
}
