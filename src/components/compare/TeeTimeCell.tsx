'use client';

import { convertESTtoLocal } from '@/lib/timezone';

/**
 * Renders a tee time for the comparison table.
 * - rapidapi: show as-is (cache is already in a display-friendly format; leaderboard does the same).
 * - espn: cache stores EST, so convert to user's local with convertESTtoLocal.
 */
export function TeeTimeCell({
  teeTime,
  source,
}: {
  teeTime?: string | null;
  source: 'rapidapi' | 'espn';
}) {
  if (!teeTime) return <td className="px-2 py-1.5 text-casino-gray">-</td>;
  const display = source === 'espn' ? convertESTtoLocal(teeTime) : teeTime;
  return <td className="px-2 py-1.5 text-casino-gray">{display}</td>;
}
