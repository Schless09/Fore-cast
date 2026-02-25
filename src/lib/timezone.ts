/**
 * Timezone utilities (getUserTimezoneAbbr, isUserInEST).
 * formatTeeTimeDisplay: shortens ESPN "Thu Feb 19 11:27:00 PST 2026" → "11:27 AM"
 * formatTeeTimeInLocalTime: converts EST tee time to user's local timezone
 */

/** Eastern offset: -5 for EST (Nov–Mar), -4 for EDT (Mar–Nov) */
function getEasternOffsetHours(dateStr: string): number {
  const m = parseInt(dateStr.slice(5, 7), 10);
  return m >= 3 && m <= 10 ? -4 : -5;
}

/**
 * Convert EST tee time (e.g. "8:30 AM") to user's local timezone.
 * Uses tournament start_date and round (1–4) to build the correct date.
 * Runs in browser; uses Intl for user's local timezone.
 */
export function formatTeeTimeInLocalTime(
  teeTime: string,
  startDate: string,
  round: number
): string {
  if (!teeTime?.trim()) return teeTime;
  const match = teeTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return teeTime; // Pass-through if not parseable
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  const [y, mo, d] = startDate.split('-').map(Number);
  const roundDate = new Date(y, mo - 1, d + (round - 1));
  const dateStr = `${roundDate.getFullYear()}-${String(roundDate.getMonth() + 1).padStart(2, '0')}-${String(roundDate.getDate()).padStart(2, '0')}`;
  const offset = getEasternOffsetHours(dateStr);
  const offsetStr = offset === -4 ? '-04:00' : '-05:00';
  const iso = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00${offsetStr}`;
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return teeTime;
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return teeTime;
  }
}

/**
 * Format tee time for display. Extracts "11:27 AM" from ESPN datetime.
 * ESPN labels PST/PDT but PGA times are Eastern — we fix that in espn-sync before cache.
 * Pass-through for already short formats like "11:35 AM".
 */
export function formatTeeTimeDisplay(teeTime: string): string {
  if (!teeTime?.trim()) return teeTime;
  // Only transform ESPN-style full datetimes (contain timezone abbrev)
  if (!/PST|PDT|EST|EDT|CST|CDT|MST|MDT|GMT|UTC/i.test(teeTime)) {
    return teeTime;
  }
  const match = teeTime.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = hours >= 12 ? 'PM' : 'AM';
    if (hours > 12) hours -= 12;
    else if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${period}`;
  }
  return teeTime;
}

/**
 * Get the user's timezone abbreviation (e.g., "PST", "EST", "CST")
 */
export function getUserTimezoneAbbr(): string {
  try {
    const date = new Date();
    const timeZoneName = date.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
    return timeZoneName || '';
  } catch {
    return '';
  }
}

/**
 * Check if user is in EST timezone
 */
export function isUserInEST(): boolean {
  const abbr = getUserTimezoneAbbr();
  return abbr === 'EST' || abbr === 'EDT';
}
