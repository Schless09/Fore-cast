'use client';

/** Renders a tee time as stored in the data (no conversion). */
export function TeeTimeCell({
  teeTime,
  source,
}: {
  teeTime?: string | null;
  source: 'rapidapi' | 'espn';
}) {
  if (!teeTime) return <td className="px-2 py-1.5 text-casino-gray">-</td>;
  return <td className="px-2 py-1.5 text-casino-gray">{teeTime}</td>;
}
