'use client';

import { convertESTtoLocal } from '@/lib/timezone';

/**
 * Normalize time string to "H:MM AM/PM" so convertESTtoLocal can parse it.
 * Handles "11:45am", "11:45 AM", "11:45".
 */
function normalizeTeeTimeForConversion(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return trimmed;
  const hours = parseInt(match[1], 10);
  const minutes = match[2];
  let period = (match[3] || '').toUpperCase();
  if (!period) {
    period = hours >= 12 ? 'PM' : 'AM';
  }
  const h12 = hours % 12 || 12;
  return `${h12}:${minutes} ${period}`;
}

/**
 * Renders a tee time in the user's local timezone.
 * Both RapidAPI and ESPN store times in Eastern; we convert to local for display.
 */
export function TeeTimeCell({
  teeTime,
  source,
}: {
  teeTime?: string | null;
  source: 'rapidapi' | 'espn';
}) {
  if (!teeTime) return <td className="px-2 py-1.5 text-casino-gray">-</td>;
  const normalized = normalizeTeeTimeForConversion(teeTime);
  const display = convertESTtoLocal(normalized);
  return <td className="px-2 py-1.5 text-casino-gray">{display}</td>;
}
