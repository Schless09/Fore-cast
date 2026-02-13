/**
 * Timezone conversion utilities
 * Tee times are stored in EST and converted to user's local timezone for display
 */

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
