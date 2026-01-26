/**
 * Salary Cap Calculation Utilities
 * Converts sportsbook odds to fantasy player costs
 */

/**
 * Convert American odds to implied probability
 * Examples: +290 = 25.6%, -145 = 59.2%
 */
export function oddsToProbability(odds: number): number {
  if (odds > 0) {
    // Positive odds: +290 means bet $100 to win $290
    return 100 / (odds + 100);
  } else {
    // Negative odds: -145 means bet $145 to win $100
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

/**
 * Calculate player cost from winner odds
 * 
 * COMPETITIVE BALANCE:
 * Prize money is heavily skewed toward winners (1st = $1.6M, 10th = $250k, 50th = $23k)
 * Top favorites cost ~$20 (67% of budget) creating real but playable tradeoffs.
 * 
 * With $30 budget, picking Scheffler ($20) leaves $10 for supporting cast.
 * This forces meaningful strategic decisions:
 * - Pick Scheffler ($20) → $10 left for ~5-6 solid supporting picks
 * - Pick a co-favorite ($13) → $17 left for balanced roster
 * - Fade the chalk → full budget for mid-tier/longshots
 * 
 * Cost mapping:
 * - +290 (Scheffler-level) → ~$20.00 (67% of budget)
 * - +500 (co-favorite) → ~$13.50
 * - +1000 (top 5) → ~$8.00
 * - +2000 (top 10) → ~$4.50
 * - +5000 (solid) → ~$2.25
 * - +10000 (mid-tier) → ~$1.50
 * - +25000 (longshot) → ~$1.00
 * - +50000+ (deep longshot) → ~$0.75
 */
export function calculateCostFromOdds(odds: number, minCost: number = 0.75, maxCost: number = 20.00): number {
  if (!odds || odds === 0 || odds > 500000) {
    return minCost;
  }

  // Convert to implied probability
  const probability = oddsToProbability(odds);

  // Use LINEAR scaling - probability directly maps to cost
  // This properly reflects that favorites have proportionally higher expected value
  // A 25% win probability player should cost ~25x more than a 1% player
  
  // Reference: +290 odds = 25.6% probability = max cost
  // Scale: cost = probability * scaleFactor + minCost
  const maxProbability = 0.256; // +290 odds
  const normalizedProb = Math.min(probability / maxProbability, 1);
  
  // Linear scaling: favorites pay full price for their expected value advantage
  const cost = (maxCost - minCost) * normalizedProb + minCost;
  
  // Ensure within bounds
  const finalCost = Math.max(minCost, Math.min(maxCost, cost));
  
  // Round to 2 decimal places
  return Math.round(finalCost * 100) / 100;
}

/**
 * Parse odds string from sportsbook format
 * Handles formats like: "+290", "-145", "+2000"
 */
export function parseOdds(oddsStr: string): number | null {
  if (!oddsStr || oddsStr.trim() === '') {
    return null;
  }
  
  const cleaned = oddsStr.trim().replace(/[^+\-0-9]/g, '');
  const parsed = parseInt(cleaned);
  
  return isNaN(parsed) ? null : parsed;
}

/**
 * Calculate total cost of a roster
 */
export function calculateRosterCost(playerCosts: number[]): number {
  return playerCosts.reduce((sum, cost) => sum + cost, 0);
}

/**
 * Check if roster is valid (under budget and max players)
 */
export function validateRoster(
  playerCosts: number[],
  budgetLimit: number = 30.00,
  maxPlayers: number = 10
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const totalCost = calculateRosterCost(playerCosts);
  
  if (playerCosts.length > maxPlayers) {
    errors.push(`Maximum ${maxPlayers} players allowed. You have ${playerCosts.length}.`);
  }
  
  if (totalCost > budgetLimit) {
    errors.push(`Budget exceeded. Total: $${totalCost.toFixed(2)}, Limit: $${budgetLimit.toFixed(2)}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate cost from odds data (for bulk import)
 * Handles both string and numeric odds
 */
export function generateCostFromOddsData(winnerOdds: string | number | null): number {
  if (!winnerOdds && winnerOdds !== 0) {
    return 0.75; // Default minimum cost
  }
  
  // If it's already a number, use it directly
  if (typeof winnerOdds === 'number') {
    return calculateCostFromOdds(winnerOdds);
  }
  
  // Parse string odds
  const odds = parseOdds(winnerOdds);
  
  if (odds === null) {
    return 0.75;
  }
  
  return calculateCostFromOdds(odds);
}
