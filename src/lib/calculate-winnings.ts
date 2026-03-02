import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateAdjustedPrizePositions,
  calculatePlayerPrizeMoney,
  detectTies,
  parsePrizeMoneyTable,
} from '@/lib/prize-money';

export interface CalculateWinningsResult {
  success: boolean;
  message: string;
  totalPurse?: number;
  playersUpdated?: number;
  error?: string;
}

/**
 * Calculate prize money for all players in a tournament based on their final positions.
 * Updates tournament_players.prize_money, roster_players.player_winnings, and user_rosters.total_winnings.
 * This handles ties by splitting prize money appropriately.
 */
export async function calculateTournamentWinnings(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<CalculateWinningsResult> {
  // Get prize money distribution for this tournament
  const { data: prizeDistributions, error: prizeError } = await supabase
    .from('prize_money_distributions')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('position', { ascending: true });

  if (prizeError || !prizeDistributions || prizeDistributions.length === 0) {
    return {
      success: false,
      message: 'Prize money distribution not found for this tournament. Please import it first.',
      error: 'NO_PRIZE_DISTRIBUTION',
    };
  }

  const totalPurse = prizeDistributions[0].total_purse;
  const prizeStructure = parsePrizeMoneyTable(
    tournamentId,
    totalPurse,
    prizeDistributions.map((d) => ({
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

  // Get all tournament players with positions and pga_players.is_amateur (from ESPN/DB)
  const { data: tournamentPlayers, error: tpError } = await supabase
    .from('tournament_players')
    .select('id, position, made_cut, pga_players(is_amateur)')
    .eq('tournament_id', tournamentId);

  console.log(`[PRIZE MONEY] Found ${tournamentPlayers?.length || 0} tournament players`);
  if (tournamentPlayers && tournamentPlayers.length > 0) {
    const withPos = (tournamentPlayers || []).filter(p => p.position != null && p.position > 0);
    const nullPos = (tournamentPlayers || []).filter(p => p.position == null || p.position <= 0);
    console.log(`[PRIZE MONEY] Players with position: ${withPos.length}, null/zero position: ${nullPos.length}`);
    console.log(`[PRIZE MONEY] Top 5 positions:`, withPos.slice(0, 5).map(p => ({ id: p.id, position: p.position })));
    if (nullPos.length > 0 && nullPos.length <= 10) {
      console.log(`[PRIZE MONEY] Players with null position (all):`, nullPos.map(p => ({ id: p.id, position: p.position })));
    } else if (nullPos.length > 0) {
      console.log(`[PRIZE MONEY] Players with null position (first 10):`, nullPos.slice(0, 10).map(p => ({ id: p.id, position: p.position })));
    }
  }

  if (tpError) {
    return {
      success: false,
      message: 'Failed to load tournament players',
      error: tpError.message,
    };
  }

  const ties = detectTies(tournamentPlayers || []);
  const playersForCalc = (tournamentPlayers || []).map((tp) => ({
    position: tp.position,
    is_amateur: (tp.pga_players as { is_amateur?: boolean } | null)?.is_amateur ?? false,
    is_tied: ties.has(tp.position || 0),
    tied_with_count: ties.has(tp.position || 0) ? ties.get(tp.position || 0) || 1 : 1,
  }));

  const adjustedPositions = calculateAdjustedPrizePositions(playersForCalc);

  // Count pros per position (for amateurs-in-tie split)
  const proCountByPosition = new Map<number, number>();
  for (const tp of tournamentPlayers || []) {
    const pos = tp.position;
    if (!pos || pos < 1) continue;
    const isAm = (tp.pga_players as { is_amateur?: boolean } | null)?.is_amateur ?? false;
    if (!isAm) {
      proCountByPosition.set(pos, (proCountByPosition.get(pos) || 0) + 1);
    }
  }

  const updates = (tournamentPlayers || []).map((tp) => {
    const position = tp.position;
    const isAmateur = (tp.pga_players as { is_amateur?: boolean } | null)?.is_amateur ?? false;
    const isTied = ties.has(position || 0);
    const tiedCount = isTied ? ties.get(position || 0) || 1 : 1;
    const adjustedPos = adjustedPositions.get(position || 0);
    const proCountInTie = position ? proCountByPosition.get(position) : tiedCount;

    const prizeMoney = calculatePlayerPrizeMoney(
      position,
      isTied,
      tiedCount,
      prizeStructure,
      isAmateur,
      adjustedPos,
      proCountInTie
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

  // Log top positions to confirm sync wrote correct positions before calculating
  const top5 = updates.filter(u => u.prize_money > 0).sort((a, b) => (b.prize_money ?? 0) - (a.prize_money ?? 0)).slice(0, 5);
  console.log(`[PRIZE MONEY] Top 5 prize allocations:`, top5.map(u => ({ id: u.id, prize_money: u.prize_money })));
  const zeroPrize = updates.filter(u => !u.prize_money || u.prize_money === 0).length;
  console.log(`[PRIZE MONEY] Players with $0 prize: ${zeroPrize} / ${updates.length}`);

  // Update roster_players with player winnings
  // Use the already-computed updates map instead of re-fetching from DB to avoid stale read issues
  const prizeByTpId = new Map(updates.map((u) => [u.id, u.prize_money]));

  const { data: rosterPlayers, error: rpError } = await supabase
    .from('roster_players')
    .select('id, tournament_player_id')
    .in(
      'tournament_player_id',
      updates.map((u) => u.id)
    );

  console.log(`[PRIZE MONEY] roster_players rows to update: ${rosterPlayers?.length ?? 0}, error: ${rpError?.message ?? 'none'}`);

  if (!rpError && rosterPlayers) {
    let nonZeroCount = 0;
    for (const rp of rosterPlayers) {
      const prizeMoney = prizeByTpId.get(rp.tournament_player_id) ?? 0;
      if (prizeMoney > 0) nonZeroCount++;

      const { error: rpUpdateError } = await supabase
        .from('roster_players')
        .update({ player_winnings: prizeMoney })
        .eq('id', rp.id);

      if (rpUpdateError) {
        console.error(`[PRIZE MONEY] ⚠️ Failed to update roster_player ${rp.id}:`, rpUpdateError.message);
      }
    }
    console.log(`[PRIZE MONEY] Updated roster_players: ${rosterPlayers.length} rows, ${nonZeroCount} with non-zero winnings`);
  }

  // Recalculate total winnings for all rosters in this tournament
  const { data: rosters, error: rostersError } = await supabase
    .from('user_rosters')
    .select('id, roster_players(player_winnings)')
    .eq('tournament_id', tournamentId);

  console.log(`[PRIZE MONEY] user_rosters to update: ${rosters?.length ?? 0}, error: ${rostersError?.message ?? 'none'}`);

  if (!rostersError && rosters) {
    for (const roster of rosters) {
      const rosterPlayers = roster.roster_players as Array<{ player_winnings?: number }> | null;
      const totalWinnings = rosterPlayers?.reduce((sum: number, rp) => sum + (rp.player_winnings || 0), 0) || 0;

      console.log(`[PRIZE MONEY] Roster ${roster.id}: ${rosterPlayers?.length ?? 0} players, total_winnings=$${totalWinnings.toLocaleString()}, player breakdown:`, rosterPlayers?.map(rp => rp.player_winnings ?? 0));

      const { error: rosterUpdateError } = await supabase
        .from('user_rosters')
        .update({ total_winnings: totalWinnings })
        .eq('id', roster.id);

      if (rosterUpdateError) {
        console.error(`[PRIZE MONEY] ⚠️ Failed to update user_roster ${roster.id}:`, rosterUpdateError.message);
      }
    }
  }

  return {
    success: true,
    message: `Calculated prize money for ${updates.length} players`,
    totalPurse: totalPurse,
    playersUpdated: updates.length,
  };
}
