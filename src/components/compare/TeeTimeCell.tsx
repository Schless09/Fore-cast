'use client';

import { convertESTtoLocal } from '@/lib/timezone';

/**
 * Renders a tee time in the user's local timezone.
 * Expects cache to store times in EST (RapidAPI / ESPN sync).
 */
export function TeeTimeCell({ teeTime }: { teeTime?: string | null }) {
  if (!teeTime) return <td className="px-2 py-1.5 text-casino-gray">-</td>;
  const local = convertESTtoLocal(teeTime);
  return <td className="px-2 py-1.5 text-casino-gray">{local}</td>;
}
