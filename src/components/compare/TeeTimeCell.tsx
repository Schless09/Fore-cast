'use client';

import { formatTeeTimeDisplay } from '@/lib/timezone';

/** Renders tee time: ESPN "Thu Feb 19 11:27:00 PST 2026" → "11:27 AM"; others pass-through. */
export function TeeTimeCell({
  teeTime,
  source,
}: {
  teeTime?: string | null;
  source: 'rapidapi' | 'espn';
}) {
  if (!teeTime) return <td className="px-2 py-1.5 text-casino-gray">-</td>;
  return <td className="px-2 py-1.5 text-casino-gray">{formatTeeTimeDisplay(teeTime)}</td>;
}
