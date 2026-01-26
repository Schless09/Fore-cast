/**
 * Shared configuration for live scoring
 * 
 * Change REFRESH_INTERVAL_MS here to update both client polling 
 * and server-side caching across the entire app.
 */

// Refresh interval for live scores
// - Development: 60 minutes (60 * 60 * 1000) to save API credits
// - Production: 3 minutes (3 * 60 * 1000) for live updates during tournaments
export const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Human-readable format for UI display
export const REFRESH_INTERVAL_MINUTES = REFRESH_INTERVAL_MS / 1000 / 60;

// Server-side cache TTL (should match refresh interval)
export const CACHE_TTL_MS = REFRESH_INTERVAL_MS;
