/**
 * Timezone conversion utilities
 * Tee times are stored in EST and converted to user's local timezone for display
 */

/**
 * Convert a time string from EST to the user's local timezone
 * @param estTimeStr - Time string in format "12:10 PM" or "1:30 AM" (assumed EST)
 * @returns Time string in user's local timezone, or original string if parsing fails
 */
export function convertESTtoLocal(estTimeStr: string): string {
  if (!estTimeStr) return estTimeStr;
  
  try {
    // Parse the time string (e.g., "12:10 PM")
    const match = estTimeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return estTimeStr; // Return as-is if format doesn't match
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    
    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    // Create a date object with EST timezone
    // Use today's date for the conversion (the actual date doesn't matter for time-only display)
    const now = new Date();
    const estDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    
    // Parse as EST (America/New_York handles EST/EDT automatically)
    const estDate = new Date(estDateStr + '-05:00'); // EST is UTC-5
    
    // Format in user's local timezone
    const localTime = estDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    return localTime;
  } catch (error) {
    console.error('Error converting timezone:', error);
    return estTimeStr; // Return original on error
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
