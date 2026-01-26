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
 * Costs should create meaningful roster decisions with a $30 budget.
 * 
 * Cost mapping (logarithmic scaling for better distribution):
 * - +290 (Scottie-level dominant) → ~$15-18 (with super-favorite multiplier)
 * - +500 (co-favorite) → ~$12-14 (with multiplier)
 * - +1500 (field favorite) → ~$7.50
 * - +3000 (solid contender) → ~$6.00
 * - +5000 (mid-tier) → ~$5.00
 * - +10000 (longshot) → ~$3.80
 * - +25000 (deep longshot) → ~$2.00
 * - +50000+ (extreme longshot) → ~$0.50
 * - +150000+ (ultra longshot) → ~$0.20
 * 
 * SUPER-FAVORITE MULTIPLIER:
 * When a player has odds of +600 or shorter, they get an additional cost multiplier.
 * This ensures dominant favorites like Scottie Scheffler are priced appropriately.
 */
export function calculateCostFromOdds(odds: number, minCost: number = 0.20, maxCost: number = 10.00): number {
  if (!odds || odds === 0 || odds > 500000) {
    return minCost;
  }

  // Convert to implied probability
  const probability = oddsToProbability(odds);

  // Use logarithmic scaling for better distribution across the field
  // This prevents costs from compressing too much for mid-tier players
  
  // Reference points for scaling:
  // +290 odds = 25.6% probability → max cost ($10, before multiplier)
  // +50000 odds = 0.2% probability → min cost ($0.20)
  
  const maxProbability = 0.256; // +290 odds
  const minProbability = 0.002; // +50000 odds
  
  // Use log scaling to spread costs more evenly
  const logMax = Math.log(maxProbability);
  const logMin = Math.log(minProbability);
  const logProb = Math.log(Math.max(probability, minProbability));
  
  // Normalize to 0-1 range using log scale
  const normalizedProb = Math.min((logProb - logMin) / (logMax - logMin), 1);
  
  // Linear curve (1.0) for balanced cost distribution
  const curvedProb = Math.pow(normalizedProb, 1.0);
  
  // Calculate base cost
  let cost = (maxCost - minCost) * curvedProb + minCost;
  
  // SUPER-FAVORITE MULTIPLIER
  // Apply extra cost for dominant favorites (odds +600 or shorter)
  // This ensures players like Scottie are priced at a premium
  const superFavoriteThreshold = 600; // +600 odds
  if (odds <= superFavoriteThreshold) {
    // Scale multiplier: +290 gets ~1.8x, +500 gets ~1.4x, +600 gets ~1.2x
    const multiplier = 1.2 + (0.6 * (superFavoriteThreshold - odds) / superFavoriteThreshold);
    cost = cost * multiplier;
  }
  
  // Ensure within bounds (allow up to $20 for super-favorites)
  const absoluteMax = 20.00;
  const finalCost = Math.max(minCost, Math.min(absoluteMax, cost));
  
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
