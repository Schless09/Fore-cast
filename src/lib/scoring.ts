import { TournamentPlayer, ScoringRule } from './types';

/**
 * Calculate fantasy points for a tournament player based on their performance
 */
export function calculateFantasyPoints(
  tournamentPlayer: TournamentPlayer,
  scoringRules: ScoringRule[]
): number {
  let points = 0;

  // Position-based points
  if (tournamentPlayer.position) {
    const position = tournamentPlayer.position;
    if (position === 1) {
      points += getRulePoints(scoringRules, 'position_1');
    } else if (position === 2) {
      points += getRulePoints(scoringRules, 'position_2');
    } else if (position === 3) {
      points += getRulePoints(scoringRules, 'position_3');
    } else if (position <= 5) {
      points += getRulePoints(scoringRules, 'position_top_5');
    } else if (position <= 10) {
      points += getRulePoints(scoringRules, 'position_top_10');
    } else if (position <= 20) {
      points += getRulePoints(scoringRules, 'position_top_20');
    }
  }

  // Cut-based points
  if (tournamentPlayer.made_cut) {
    points += getRulePoints(scoringRules, 'made_cut');
  } else {
    points += getRulePoints(scoringRules, 'cut_missed');
  }

  // Note: Birdie/Eagle bonuses would require detailed round-by-round data
  // This would typically come from an API with hole-by-hole scores
  // For now, we'll base it on the total score relative to par
  // You can enhance this later with detailed scoring data

  return points;
}

/**
 * Get points for a specific scoring rule
 */
function getRulePoints(rules: ScoringRule[], ruleType: string): number {
  const rule = rules.find((r) => r.rule_type === ruleType);
  return rule?.points || 0;
}

/**
 * Calculate total fantasy points for a roster
 */
export function calculateRosterTotalPoints(
  rosterPlayers: Array<{ fantasy_points: number }>
): number {
  return rosterPlayers.reduce((total, rp) => total + rp.fantasy_points, 0);
}
