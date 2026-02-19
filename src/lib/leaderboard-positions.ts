/**
 * Assign leaderboard positions from scores so ties get the same position
 * and prize money can be split correctly. ESPN (and some APIs) return
 * order 1,2,3 for tied players; we derive position from total/today/thru.
 */

export interface Scoreable {
  total_score: number;
  today_score?: number;
  thru?: string | number;
}

function thruToSortValue(thru: string | number | undefined): number {
  if (thru === undefined || thru === null) return 0;
  if (thru === 'F') return 18;
  if (typeof thru === 'number') return thru;
  const s = String(thru).replace('*', '').trim();
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Compare two scoreables for sort: lower total is better, then lower today, then higher thru.
 */
function compareScoreable(a: Scoreable, b: Scoreable): number {
  if (a.total_score !== b.total_score) return a.total_score - b.total_score;
  const todayA = a.today_score ?? 999;
  const todayB = b.today_score ?? 999;
  if (todayA !== todayB) return todayA - todayB;
  return thruToSortValue(b.thru) - thruToSortValue(a.thru); // more holes = better
}

export interface PositionResult<T> {
  item: T;
  position: number;
  tieCount: number;
}

/**
 * Sort items by score and assign position with ties.
 * Position is by total score only (PGA standard) so e.g. all -1 are T1 even if today/thru differ.
 * Returns array of { item, position, tieCount } so prize can be (sum of prize[pos..pos+tieCount-1]) / tieCount.
 */
export function assignPositionsByScore<T extends Scoreable>(
  items: T[]
): PositionResult<T>[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort(compareScoreable);
  const results: PositionResult<T>[] = [];
  let rank = 1;
  let i = 0;
  while (i < sorted.length) {
    const curr = sorted[i];
    const prev = sorted[i - 1];
    if (i === 0 || curr.total_score !== prev.total_score) {
      rank = i + 1;
    }
    // Count entire tie group so every member gets same tieCount (prize split evenly)
    let tieCount = 0;
    const groupTotal = curr.total_score;
    while (i < sorted.length && sorted[i].total_score === groupTotal) {
      tieCount++;
      i++;
    }
    // Assign same position and tieCount to all in group
    for (let k = 0; k < tieCount; k++) {
      results.push({ item: sorted[i - tieCount + k], position: rank, tieCount });
    }
  }
  return results;
}
