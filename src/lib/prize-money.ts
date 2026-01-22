/**
 * Prize Money Calculation System
 * Calculates tournament winnings based on final position and handles ties
 */

export interface PrizeMoneyDistribution {
  position: number;
  percentage: number | null;
  amount: number;
  // Tie handling amounts (for 2 tied, 3 tied, etc.)
  tied_2?: number;
  tied_3?: number;
  tied_4?: number;
  tied_5?: number;
  tied_6?: number;
  tied_7?: number;
  tied_8?: number;
  tied_9?: number;
  tied_10?: number;
}

export interface TournamentPrizeStructure {
  tournament_id: string;
  total_purse: number;
  distributions: PrizeMoneyDistribution[];
}

/**
 * Calculate prize money for a player based on their position
 * Handles ties by splitting the combined prize money of tied positions
 */
export function calculatePlayerPrizeMoney(
  position: number | null,
  isTied: boolean,
  tiedCount: number,
  prizeStructure: TournamentPrizeStructure
): number {
  if (!position || position < 1) {
    return 0; // No prize money for CUT, WD, or invalid positions
  }

  const distribution = prizeStructure.distributions.find(
    (d) => d.position === position
  );

  if (!distribution) {
    // If no exact match, find the closest lower position
    const closest = prizeStructure.distributions
      .filter((d) => d.position <= position)
      .sort((a, b) => b.position - a.position)[0];

    if (!closest) {
      return 0; // Position too low to earn prize money
    }

    // Use the closest position's amount
    return closest.amount;
  }

  // Handle ties
  if (isTied && tiedCount > 1) {
    // Use pre-calculated tie amounts from the distribution table
    const tieField = `tied_${tiedCount}` as keyof PrizeMoneyDistribution;
    let tieAmount = distribution[tieField] as number | string | undefined;

    // Convert string to number if needed
    if (typeof tieAmount === 'string') {
      tieAmount = parseFloat(tieAmount);
    }

    if (tieAmount !== undefined && !isNaN(tieAmount)) {
      return tieAmount;
    }

    // Fallback: Calculate total prize money for all tied positions and split evenly
    let totalTiedMoney = 0;
    const positionsToSplit: number[] = [];

    // Collect positions that need to be split
    for (let i = 0; i < tiedCount; i++) {
      const pos = position + i;
      const dist = prizeStructure.distributions.find((d) => d.position === pos);
      if (dist) {
        totalTiedMoney += dist.amount;
        positionsToSplit.push(pos);
      }
    }

    // Split evenly among tied players
    return Math.round(totalTiedMoney / tiedCount);
  }

  // No tie, return the base amount
  return distribution.amount;
}

/**
 * Parse prize money distribution from the provided table format
 * Example: Position 1 gets 18% = $1,656,000
 */
export function parsePrizeMoneyTable(
  tournamentId: string,
  totalPurse: number,
  prizeTable: Array<{
    position: number;
    percentage: number;
    amount: number;
    tied_2?: number;
    tied_3?: number;
    tied_4?: number;
    tied_5?: number;
    tied_6?: number;
    tied_7?: number;
    tied_8?: number;
    tied_9?: number;
    tied_10?: number;
  }>
): TournamentPrizeStructure {
  return {
    tournament_id: tournamentId,
    total_purse: totalPurse,
    distributions: prizeTable.map((row) => ({
      position: row.position,
      percentage: row.percentage,
      amount: row.amount,
      tied_2: row.tied_2,
      tied_3: row.tied_3,
      tied_4: row.tied_4,
      tied_5: row.tied_5,
      tied_6: row.tied_6,
      tied_7: row.tied_7,
      tied_8: row.tied_8,
      tied_9: row.tied_9,
      tied_10: row.tied_10,
    })),
  };
}

/**
 * Detect ties from tournament player positions
 * Returns a map of position -> tied count
 */
export function detectTies(
  players: Array<{ position: number | null }>
): Map<number, number> {
  const positionCounts = new Map<number, number>();

  players.forEach((player) => {
    if (player.position && player.position > 0) {
      const count = positionCounts.get(player.position) || 0;
      positionCounts.set(player.position, count + 1);
    }
  });

  // Filter to only positions with ties (count > 1)
  const ties = new Map<number, number>();
  positionCounts.forEach((count, position) => {
    if (count > 1) {
      ties.set(position, count);
    }
  });

  return ties;
}

/**
 * Calculate total winnings for a roster
 */
export function calculateRosterTotalWinnings(
  rosterPlayers: Array<{ player_winnings: number }>
): number {
  return rosterPlayers.reduce(
    (total, rp) => total + (rp.player_winnings || 0),
    0
  );
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
