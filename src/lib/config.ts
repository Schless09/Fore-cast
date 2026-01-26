/**
 * Shared configuration for live scoring
 * 
 * The architecture is now:
 * 1. Server-side cron polls RapidAPI (smart scheduling, respects rate limits)
 * 2. Results cached in Supabase
 * 3. Clients poll our /api/scores/live endpoint (reads from cache, free!)
 * 
 * Since client requests hit our cache (not the API), we can poll more frequently
 * for a responsive UI without burning API credits.
 */

// Client refresh interval - how often the browser fetches from our cache
// This is cheap (no external API calls), so we can be more aggressive
export const REFRESH_INTERVAL_MS = 60 * 1000; // 1 minute

// Human-readable format for UI display
export const REFRESH_INTERVAL_MINUTES = REFRESH_INTERVAL_MS / 1000 / 60;

// Server-side cache TTL - not used anymore since we read from DB cache
// Keeping for backwards compatibility if any code still references it
export const CACHE_TTL_MS = REFRESH_INTERVAL_MS;
