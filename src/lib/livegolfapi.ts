import fs from 'fs/promises';
import path from 'path';

/**
 * Helper functions for integrating with LiveGolfAPI.com
 * Base URL: https://use.livegolfapi.com
 * Authentication: x-api-key header
 */

interface LiveGolfAPIEvent {
  id: string;
  name: string;
  course?: string;
  location?: string;
  startDatetime: string;
  endDatetime: string;
  status: string;
  tour?: {
    name: string;
  };
}

interface LiveGolfAPIRound {
  round: number;
  score: number | null;
  total: string | null;
  thru: string;
  position: string;
  teeTime?: string;
  startingTee?: number;
}

interface LiveGolfAPIScorecard {
  id: string;
  tournament: string;
  player: string;
  position: string;
  positionValue: number;
  total: string;
  strokes: string;
  rounds: LiveGolfAPIRound[];
}

const CACHE_DIR = path.join(process.cwd(), '.cache', 'livegolfapi');

// Cache TTL: 3 minutes for live tournaments
// This prevents excessive API calls when users refresh frequently
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

interface CacheEntry {
  data: any;
  timestamp: number;
}

async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {
    //
  }
}

async function writeCache(eventId: string, data: any) {
  try {
    await ensureCacheDir();
    const cacheEntry: CacheEntry = {
      data,
      timestamp: Date.now(),
    };
    await fs.writeFile(
      path.join(CACHE_DIR, `${eventId}.json`),
      JSON.stringify(cacheEntry),
      'utf-8'
    );
  } catch (error) {
    console.warn('Failed to cache LiveGolfAPI response:', error);
  }
}

async function readCache(eventId: string): Promise<{ data: any; age: number; isStale: boolean } | null> {
  try {
    const cachePath = path.join(CACHE_DIR, `${eventId}.json`);
    const content = await fs.readFile(cachePath, 'utf-8');
    const parsed = JSON.parse(content);
    
    // Handle both old cache format (raw data) and new format (with timestamp)
    let data: any;
    let timestamp: number;
    
    if (parsed.timestamp !== undefined && parsed.data !== undefined) {
      // New format with timestamp
      data = parsed.data;
      timestamp = parsed.timestamp;
    } else {
      // Old format - treat as stale but still usable as fallback
      data = parsed;
      timestamp = 0; // Very old, will be marked as stale
    }
    
    const age = Date.now() - timestamp;
    const isStale = age > CACHE_TTL_MS;
    
    console.log(`[LiveGolfAPI] Cache found for ${eventId}. Age: ${Math.round(age / 1000)}s, Stale: ${isStale}`);
    
    return { data, age, isStale };
  } catch (error: any) {
    console.log(`[LiveGolfAPI] Cache miss for ${eventId}:`, error?.message);
    return null;
  }
}

/**
 * Transform LiveGolfAPI total score string to number
 * Examples: "-7" → -7, "+3" → 3, "E" → 0
 */
function parseScore(scoreStr: string | null): number {
  if (!scoreStr || scoreStr === '-') return 0;
  if (scoreStr === 'E') return 0;
  if (scoreStr.startsWith('-')) return -parseInt(scoreStr.slice(1));
  if (scoreStr.startsWith('+')) return parseInt(scoreStr.slice(1));
  return parseInt(scoreStr);
}

/**
 * Get current round (today's round) from rounds array
 */
function getCurrentRound(rounds: LiveGolfAPIRound[]): LiveGolfAPIRound | null {
  // Find the most recent completed round
  const completedRounds = rounds.filter((r) => r.score !== null && r.thru !== '-');
  return completedRounds.length > 0 
    ? completedRounds[completedRounds.length - 1] 
    : null;
}

/**
 * Fetch all events/tournaments from LiveGolfAPI
 */
export async function fetchEventsFromLiveGolfAPI(): Promise<LiveGolfAPIEvent[]> {
  const apiKey = process.env.LIVEGOLFAPI_KEY;
  
  if (!apiKey) {
    throw new Error('LIVEGOLFAPI_KEY is not set in environment variables');
  }

  try {
    const response = await fetch(
      'https://use.livegolfapi.com/v1/events',
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`LiveGolfAPI error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching events from LiveGolfAPI:', error);
    throw error;
  }
}

/**
 * Fetch leaderboard/scores from LiveGolfAPI for a tournament
 * The endpoint returns an object with a leaderboard array; we extract and return that array
 */
type LiveGolfAPIScoresResult = {
  data: LiveGolfAPIScorecard[] | null;
  source: 'livegolfapi' | 'cache' | 'none';
  timestamp?: number; // Unix timestamp of when data was fetched/cached
  error?: string;
};

export async function fetchScoresFromLiveGolfAPI(
  eventId: string
): Promise<LiveGolfAPIScoresResult> {
  const apiKey = process.env.LIVEGOLFAPI_KEY;
  
  if (!apiKey) {
    throw new Error('LIVEGOLFAPI_KEY is not set in environment variables');
  }

  // Check cache first - if fresh, return immediately
  const cached = await readCache(eventId);
  if (cached && !cached.isStale) {
    console.log(`[LiveGolfAPI] Using fresh cache for ${eventId} (${Math.round(cached.age / 1000)}s old)`);
    return { 
      data: cached.data, 
      source: 'cache',
      timestamp: Date.now() - cached.age // Original fetch time
    };
  }

  // Cache is stale or missing - fetch from API
  try {
    console.log(`[LiveGolfAPI] Fetching fresh data from API for event: ${eventId}`);
    const response = await fetch(
      `https://use.livegolfapi.com/v1/events/${eventId}`,
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Prevent Next.js from caching failed requests
      }
    );
    console.log(`[LiveGolfAPI] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      const message = `LiveGolfAPI error (${response.status}): ${
        errorText || response.statusText
      }`;
      console.warn(message);
      
      // API failed - use stale cache if available
      if (cached) {
        console.log(`[LiveGolfAPI] API failed, falling back to stale cache (${Math.round(cached.age / 1000)}s old)`);
        return { 
          data: cached.data, 
          source: 'cache', 
          timestamp: Date.now() - cached.age,
          error: message 
        };
      }
      return { data: null, source: 'none', error: message };
    }

    const json = await response.json();
    // Extract the leaderboard array from the response
    const leaderboard = json.leaderboard || json;
    const fetchTime = Date.now();
    await writeCache(eventId, leaderboard);

    console.log(`[LiveGolfAPI] Successfully fetched and cached ${Array.isArray(leaderboard) ? leaderboard.length : 'unknown'} records`);
    return { 
      data: leaderboard, 
      source: 'livegolfapi',
      timestamp: fetchTime
    };
  } catch (error: any) {
    console.error('Error fetching scores from LiveGolfAPI:', error);
    
    // Network error - use stale cache if available
    if (cached) {
      console.log(`[LiveGolfAPI] Network error, falling back to stale cache (${Math.round(cached.age / 1000)}s old)`);
      return { 
        data: cached.data, 
        source: 'cache',
        timestamp: Date.now() - cached.age,
        error: error?.message 
      };
    }
    return { data: null, source: 'none', error: error?.message };
  }
}

/**
 * Transform LiveGolfAPI scorecards to our format
 * Maps player names to our pga_player_ids
 */
export function transformLiveGolfAPIScores(
  scorecards: LiveGolfAPIScorecard[],
  playerNameMap: Map<string, string> // Map from player name to our pga_player_id
): Array<{
  pgaPlayerId: string;
  total_score: number;
  today_score: number;
  thru: number;
  position: number | null;
  made_cut: boolean;
  round_1_score: number | null;
  round_2_score: number | null;
  round_3_score: number | null;
  round_4_score: number | null;
}> {
  return scorecards
    .map((scorecard) => {
      const pgaPlayerId = playerNameMap.get(scorecard.player.toLowerCase().trim());
      if (!pgaPlayerId) {
        console.warn(`No mapping found for player: ${scorecard.player}`);
        return null;
      }

      // Parse total score
      const total_score = parseScore(scorecard.total);

      // Get current round for today_score and thru
      const currentRound = getCurrentRound(scorecard.rounds);
      const today_score = currentRound ? parseScore(currentRound.total) : 0;
      const thru = currentRound && currentRound.thru !== '-' 
        ? parseInt(currentRound.thru) || 0 
        : 0;

      // Parse position (positionValue >= 980 means CUT/WD)
      const position = scorecard.positionValue >= 980 ? null : scorecard.positionValue;
      const made_cut = scorecard.positionValue < 980;

      // Extract round scores
      const round_1 = scorecard.rounds.find((r) => r.round === 1);
      const round_2 = scorecard.rounds.find((r) => r.round === 2);
      const round_3 = scorecard.rounds.find((r) => r.round === 3);
      const round_4 = scorecard.rounds.find((r) => r.round === 4);

      return {
        pgaPlayerId,
        total_score,
        today_score,
        thru,
        position,
        made_cut,
        round_1_score: round_1?.score ?? null,
        round_2_score: round_2?.score ?? null,
        round_3_score: round_3?.score ?? null,
        round_4_score: round_4?.score ?? null,
      };
    })
    .filter(Boolean) as any[];
}
