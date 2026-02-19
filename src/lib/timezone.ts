/**
 * Timezone conversion utilities
 * - ESPN: full datetimes (e.g. "Thu Feb 19 08:03:00 PST 2026") — parse and display in user's local
 * - RapidAPI/DB: time-only (e.g. "11:35 AM") assumed Eastern — convert to user's local
 */

/**
 * Format a tee time for display in the user's local timezone.
 * Handles both full datetimes (ESPN) and time-only strings (RapidAPI/DB, assumed Eastern).
 */
export function formatTeeTimeForDisplay(teeTime: string): string {
  if (!teeTime) return teeTime;

  // Full datetime: contains timezone (PST/EST/CST/etc), ISO "T", or explicit date
  const isFullDatetime =
    /PST|PDT|EST|EDT|CST|CDT|MST|MDT|GMT|UTC|-\d{4}|\+\d{4}/i.test(teeTime) ||
    /^\d{4}-\d{2}-\d{2}T/.test(teeTime) ||
    /[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{1,2}:\d{2}:\d{2}/.test(teeTime);

  if (isFullDatetime) {
    try {
      const d = new Date(teeTime);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }
    } catch {
      /* fall through to EST handling */
    }
  }

  return convertESTtoLocal(teeTime);
}

/**
 * Convert a time string from Eastern (ET) to the user's local timezone.
 * @param estTimeStr - Time string in format "12:10 PM", "1:30 AM", or "11:45am" (assumed Eastern)
 * @returns Time string in user's local timezone, or original string if parsing fails
 */
export function convertESTtoLocal(estTimeStr: string): string {
  if (!estTimeStr) return estTimeStr;

  try {
    const match = estTimeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return estTimeStr;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    else if (period === 'AM' && hours === 12) hours = 0;

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const day = now.getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${y}-${pad(m + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;

    // America/New_York: EST (UTC-5) or EDT (UTC-4). Rough DST: March–October.
    const inDST = m >= 2 && m <= 9;
    const offset = inDST ? '-04:00' : '-05:00';
    const etMoment = new Date(dateStr + offset);

    return etMoment.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Error converting timezone:', error);
    return estTimeStr;
  }
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
