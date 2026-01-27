/**
 * Prize Money Calculation System
 * Calculates tournament winnings based on final position and handles ties
 * Also handles amateur players who cannot collect prize money (money moves down)
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

export interface PlayerForPrizeCalc {
  position: number | null;
  is_amateur?: boolean;
  is_tied?: boolean;
  tied_with_count?: number;
}

/**
 * Calculate adjusted prize positions accounting for amateurs.
 * Amateurs can't collect prize money, so pros below them move up in the payout.
 * Returns a map of original position -> adjusted payout position
 */
export function calculateAdjustedPrizePositions(
  players: PlayerForPrizeCalc[]
): Map<number, number> {
  const adjustedPositions = new Map<number, number>();
  
  // Sort players by position
  const sortedPlayers = [...players]
    .filter(p => p.position && p.position > 0)
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  
  // Count amateurs ahead of each position
  let amateurCount = 0;
  
  for (const player of sortedPlayers) {
    if (!player.position) continue;
    
    if (player.is_amateur) {
      // Amateurs don't get prize money, increment count for those below
      amateurCount++;
      adjustedPositions.set(player.position, 0); // 0 means no prize
    } else {
      // Pros move up by the number of amateurs ahead of them
      const adjustedPosition = player.position - amateurCount;
      adjustedPositions.set(player.position, adjustedPosition);
    }
  }
  
  return adjustedPositions;
}

/**
 * Calculate prize money for a player based on their position
 * Handles ties by splitting the combined prize money of tied positions
 * @param adjustedPosition - Position after accounting for amateurs (use calculateAdjustedPrizePositions)
 */
export function calculatePlayerPrizeMoney(
  position: number | null,
  isTied: boolean,
  tiedCount: number,
  prizeStructure: TournamentPrizeStructure,
  isAmateur: boolean = false,
  adjustedPosition?: number
): number {
  // Amateurs cannot collect prize money
  if (isAmateur) {
    return 0;
  }
  
  // Use adjusted position if provided (accounts for amateurs above)
  const effectivePosition = adjustedPosition ?? position;
  
  if (!effectivePosition || effectivePosition < 1) {
    return 0; // No prize money for CUT, WD, or invalid positions
  }

  const distribution = prizeStructure.distributions.find(
    (d) => d.position === effectivePosition
  );

  if (!distribution) {
    // If no exact match, find the closest lower position
    const closest = prizeStructure.distributions
      .filter((d) => d.position <= effectivePosition)
      .sort((a, b) => b.position - a.position)[0];

    if (!closest) {
      return 0; // Position too low to earn prize money
    }

    // Use the closest position's amount
    return closest.amount;
  }

  // Handle ties (note: tie amounts may need recalculation if amateurs are in the tie)
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

    // Collect positions that need to be split
    for (let i = 0; i < tiedCount; i++) {
      const pos = effectivePosition + i;
      const dist = prizeStructure.distributions.find((d) => d.position === pos);
      if (dist) {
        totalTiedMoney += dist.amount;
      }
    }

    // Split evenly among tied players
    return Math.round(totalTiedMoney / tiedCount);
  }

  // No tie, return the base amount
  return distribution.amount;
}

/**
 * Calculate prize money for all players in a tournament, handling amateurs correctly.
 * Money from amateur positions moves down to pros below them.
 */
export function calculateAllPlayerPrizeMoney(
  players: Array<{
    id: string;
    position: number | null;
    is_amateur?: boolean;
    is_tied?: boolean;
    tied_with_count?: number;
  }>,
  prizeStructure: TournamentPrizeStructure
): Map<string, number> {
  const results = new Map<string, number>();
  
  // Calculate adjusted positions accounting for amateurs
  const adjustedPositions = calculateAdjustedPrizePositions(players);
  
  for (const player of players) {
    if (!player.position || player.position < 1) {
      results.set(player.id, 0);
      continue;
    }
    
    const adjustedPos = adjustedPositions.get(player.position) || 0;
    
    const prizeMoney = calculatePlayerPrizeMoney(
      player.position,
      player.is_tied || false,
      player.tied_with_count || 1,
      prizeStructure,
      player.is_amateur || false,
      adjustedPos
    );
    
    results.set(player.id, prizeMoney);
  }
  
  return results;
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
