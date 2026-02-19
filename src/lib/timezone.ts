/**
 * Timezone utilities (getUserTimezoneAbbr, isUserInEST).
 * formatTeeTimeDisplay: shortens ESPN "Thu Feb 19 11:27:00 PST 2026" → "11:27 AM"
 */

/**
 * Format tee time for display. ESPN sends "Thu Feb 19 11:27:00 PST 2026" but the time is Eastern (US TV).
 * Render as "11:27 AM ET". Pass-through for already short formats like "11:35 AM".
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
    return `${hours}:${minutes} ${period} ET`;
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
