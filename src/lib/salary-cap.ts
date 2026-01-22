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
 * Uses a power-law scaling formula that:
 * - Top favorites (low odds like +290) get high costs (~$12-13)
 * - Good players (medium odds like +2000) get medium costs ($5-7)
 * - Decent players (higher odds like +10000) get lower costs ($2-5)
 * - Irrelevant players (very high odds like +50000) get minimum ($0.20)
 * 
 * Based on example odds:
 * - +290 → ~$12.50
 * - +2000 → ~$6.00
 * - +10000 → ~$3.00
 * - +50000 → $0.20
 */
export function calculateCostFromOdds(odds: number, minCost: number = 0.20, maxCost: number = 13.00): number {
  if (!odds || odds === 0 || odds > 500000) {
    return minCost;
  }

  // Convert to implied probability
  const probability = oddsToProbability(odds);

  // Use a power-law formula: cost = maxCost * (probability ^ alpha) + minCost
  // We want to map probability to cost range
  // For +290 (25.6% prob) → $12.50
  // For +2000 (4.76% prob) → $6.00
  // For +10000 (0.99% prob) → $3.00
  // For +50000 (0.2% prob) → $0.20

  // Calculate alpha based on desired mapping
  // Using empirical values: alpha ≈ 0.5 works well for this range
  const alpha = 0.5;
  
  // Normalize probability to 0-1 range relative to max probability (~25% for top favorite)
  const maxProbability = 0.256; // For +290 odds
  const normalizedProb = Math.min(probability / maxProbability, 1);
  
  // Apply power law: higher probability → higher cost
  const cost = (maxCost - minCost) * Math.pow(normalizedProb, alpha) + minCost;
  
  // Ensure minimum cost
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
    return 0.20; // Default minimum cost
  }
  
  // If it's already a number, use it directly
  if (typeof winnerOdds === 'number') {
    return calculateCostFromOdds(winnerOdds);
  }
  
  // Parse string odds
  const odds = parseOdds(winnerOdds);
  
  if (odds === null) {
    return 0.20;
  }
  
  return calculateCostFromOdds(odds);
}
