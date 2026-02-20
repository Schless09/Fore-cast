/**
 * Shared prize money logic for live leaderboard, personal leaderboard, and standings.
 * Handles: position-from-score (ESPN/RapidAPI), tie split.
 * All players get position and prize calculated from total score; hasTeedOff retained for UI (Today dash, Thru).
 */

import { assignPositionsByScore } from './leaderboard-positions';

export interface LiveScoreLike {
  player: string;
  playerId?: string;
  positionValue?: number | null;
  position?: string;
  total?: string | number;
  thru?: string;
  currentRoundScore?: string | number;
  teeTime?: string;
  isAmateur?: boolean;
}

/** Player has teed off if thru shows holes played (1, 2, F) not a tee time (1:39 PM) */
export function hasTeedOff(thru: string | number | undefined): boolean {
  if (thru === undefined || thru === null) return false;
  const s = String(thru).trim();
  if (s === '-' || s === '' || s === '0') return false;
  if (s === 'F' || s === '18') return true;
  if (s.includes(':') || s.includes('AM') || s.includes('PM')) return false;
  const n = parseInt(s.replace('*', ''), 10);
  return !Number.isNaN(n) && n > 0;
}

function parseScore(score: string | number | null): number {
  if (score === null || score === undefined) return 0;
  if (typeof score === 'number') return score;
  if (score === 'E') return 0;
  const s = String(score).trim();
  if (s.startsWith('+')) return parseInt(s.slice(1), 10) || 0;
  if (s.startsWith('-')) return -(parseInt(s.slice(1), 10) || 0);
  return parseInt(s, 10) || 0;
}

export function normalizeNameForLookup(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** First-name nickname aliases so "Matti Schmid" (DB) matches "Matthias Schmid" (ESPN) and vice versa */
export const FIRST_NAME_ALIASES: Record<string, string[]> = {
  cam: ['cameron'],
  cameron: ['cam'],
  dan: ['daniel'],
  daniel: ['dan'],
  johnny: ['john', 'jon'],
  john: ['johnny', 'jon'],
  jon: ['john', 'johnny'],
  matti: ['matt', 'matthias'],
  matt: ['matthias', 'matti'],
  matthias: ['matt', 'matti'],
  nico: ['nicolas'],
  nicolas: ['nico'],
  's.t.': ['seung taek', 'seung'],
  seung: ['s.t.'],
  'seung taek': ['s.t.'],
};

/** Returns true if two first names match (exact, prefix, or alias) */
export function firstNamesMatchForLiveScores(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  if (FIRST_NAME_ALIASES[a]?.includes(b)) return true;
  if (FIRST_NAME_ALIASES[b]?.includes(a)) return true;
  return false;
}

export interface ProcessedPrizeData {
  position: number | null;
  tieCount: number;
  hasTeedOff: boolean;
  winnings: number;
  positionDisplay: string; // "T1", "5", or ""
}

/**
 * Process live scores and return prize data keyed by normalized player name.
 * All players get position (from total score) and prize calculated.
 * hasTeedOff retained for UI (Today dash when not started, Thru tee time vs holes).
 */
export function processLiveScoresForPrizes(
  scores: LiveScoreLike[],
  source: 'espn' | 'rapidapi',
  prizeMap: Map<number, number>
): Map<string, ProcessedPrizeData> {
  const result = new Map<string, ProcessedPrizeData>();

  const calculateTiePrize = (position: number, tieCount: number): number => {
    let total = 0;
    for (let i = 0; i < tieCount; i++) {
      total += prizeMap.get(position + i) || 0;
    }
    return Math.round(total / tieCount);
  };

  if (source === 'espn' && scores.length > 0) {
    // Derive position from total score for ALL players
    const withScores = scores.map((s, i) => ({
      index: i,
      total_score: parseScore(s.total ?? 0),
      today_score: parseScore(s.currentRoundScore ?? s.total ?? 0),
      thru: s.thru ?? '-',
    }));
    const positionResults = assignPositionsByScore(withScores);
    const positionByIndex = new Map<number, { position: number; tieCount: number }>();
    for (const { item, position, tieCount } of positionResults) {
      positionByIndex.set(item.index, { position, tieCount });
    }

    scores.forEach((score, idx) => {
      const key = normalizeNameForLookup(score.player);
      const teedOff = hasTeedOff(score.thru ?? score.teeTime);
      const fromScore = positionByIndex.get(idx);
      const position = fromScore ? fromScore.position : null;
      const tieCount = fromScore?.tieCount ?? 1;
      const winnings = !score.isAmateur && position ? calculateTiePrize(position, tieCount) : 0;
      const positionDisplay = position ? (tieCount > 1 ? `T${position}` : String(position)) : '';
      result.set(key, {
        position,
        tieCount,
        hasTeedOff: teedOff,
        winnings,
        positionDisplay,
      });
    });
    return result;
  }

  // RapidAPI: use positionValue; count by position for ties; all get prize
  const positionCounts = new Map<number, number>();
  scores.forEach((s) => {
    const pos = s.positionValue ?? (s.position ? parseInt(String(s.position).replace('T', '')) : null);
    if (pos && pos > 0) {
      positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1);
    }
  });

  scores.forEach((score) => {
    const key = normalizeNameForLookup(score.player);
    const teedOff = hasTeedOff(score.thru ?? score.teeTime);
    const position = score.positionValue ?? (score.position ? parseInt(String(score.position).replace('T', '')) : null);
    const tieCount = position ? (positionCounts.get(position) || 1) : 1;
    const winnings = !score.isAmateur && position ? calculateTiePrize(position, tieCount) : 0;
    const positionDisplay = position ? (tieCount > 1 ? `T${position}` : String(position)) : '';
    result.set(key, {
      position,
      tieCount,
      hasTeedOff: teedOff,
      winnings,
      positionDisplay,
    });
  });
  return result;
}

/** Look up prize data by player name (DB format). Handles fuzzy match for Matti/Matthias etc. */
export function getPrizeDataForPlayer(
  processedMap: Map<string, ProcessedPrizeData>,
  playerName: string
): ProcessedPrizeData | undefined {
  const key = normalizeNameForLookup(playerName);
  const exact = processedMap.get(key);
  if (exact) return exact;
  const parts = key.split(/\s+/);
  if (parts.length < 2) return undefined;
  const lastName = parts[parts.length - 1];
  const firstName = parts[0];
  for (const [mapKey, data] of processedMap) {
    const mapParts = mapKey.split(/\s+/);
    if (mapParts.length >= 2 && mapParts[mapParts.length - 1] === lastName && firstNamesMatchForLiveScores(firstName, mapParts[0])) {
      return data;
    }
  }
  return undefined;
}
