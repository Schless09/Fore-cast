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

// Cache TTL: 5 minutes for production use
// This prevents excessive API calls while keeping data reasonably fresh
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
 * Returns the round currently being played (has thru info) or the most recent round
 */
function getCurrentRound(rounds: LiveGolfAPIRound[]): LiveGolfAPIRound | null {
  if (!rounds || rounds.length === 0) return null;
  
  // Find the round currently in progress (has a thru value that's not '-' or null)
  const activeRound = rounds.find((r) => r.thru && r.thru !== '-');
  if (activeRound) {
    console.log(`[getCurrentRound] Found active round: Round ${activeRound.round}, thru: ${activeRound.thru}`);
    return activeRound;
  }
  
  // If no active round, get the highest round number (most recent)
  const sortedRounds = [...rounds].sort((a, b) => (b.round || 0) - (a.round || 0));
  const latestRound = sortedRounds[0];
  console.log(`[getCurrentRound] No active round, using latest: Round ${latestRound?.round}`);
  return latestRound || null;
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
    const cacheTimestamp = Date.now() - cached.age;
    console.log(`[LiveGolfAPI] Using fresh cache for ${eventId} (${Math.round(cached.age / 1000)}s old, timestamp: ${new Date(cacheTimestamp).toISOString()})`);
    return {
      data: cached.data,
      source: 'cache',
      timestamp: cacheTimestamp
    };
  }

  // Cache is stale or missing - fetch from API
  try {
    const fetchStartTime = Date.now();
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
    console.log(`[LiveGolfAPI] Response status: ${response.status}, fetch took ${Date.now() - fetchStartTime}ms`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      const message = `LiveGolfAPI error (${response.status}): ${
        errorText || response.statusText
      }`;
      console.error(`[LiveGolfAPI] API CALL FAILED:`, message);
      console.error(`[LiveGolfAPI] URL: https://use.livegolfapi.com/v1/events/${eventId}`);
      console.error(`[LiveGolfAPI] API Key present: ${!!apiKey}`);
      
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

    console.log(`[LiveGolfAPI] ✅ SUCCESSFULLY FETCHED FRESH DATA: ${Array.isArray(leaderboard) ? leaderboard.length : 'unknown'} records`);
    console.log(`[LiveGolfAPI] Sample player:`, leaderboard?.[0]?.player || 'No players');
    
    // Log first 3 players with full data for debugging
    if (Array.isArray(leaderboard) && leaderboard.length > 0) {
      console.log('=== LiveGolfAPI Response Sample (First 3 Players) ===');
      leaderboard.slice(0, 3).forEach((player, idx) => {
        console.log(`\n--- Player ${idx + 1}: ${player.player} ---`);
        console.log(JSON.stringify(player, null, 2));
      });
      console.log('=== End Sample ===\n');
    }
    
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
 * Fetch minimal scores from LiveGolfAPI - only essential data for performance
 * Returns just player name, position, total score, thru, and tee_time
 */
export async function fetchMinimalScoresFromLiveGolfAPI(
  eventId: string
): Promise<{
  data: Array<{
    player: string;
    position: number | null;
    total_score: number;
    thru: string | null;
    tee_time: string | null;
  }> | null;
  source: 'livegolfapi' | 'cache' | 'none';
  timestamp?: number;
  error?: string;
}> {
  const apiKey = process.env.LIVEGOLFAPI_KEY;

  if (!apiKey) {
    throw new Error('LIVEGOLFAPI_KEY is not set in environment variables');
  }

  // Check cache first
  const cached = await readCache(eventId);
  if (cached && !cached.isStale) {
    console.log(`[LiveGolfAPI] Using fresh cache for ${eventId} (minimal data)`);
    return {
      data: cached.data as Array<{
        player: string;
        position: number | null;
        total_score: number;
        thru: string | null;
        tee_time: string | null;
      }> | null,
      source: 'cache',
      timestamp: Date.now() - cached.age
    };
  }

  try {
    console.log(`[LiveGolfAPI] Fetching minimal data from API for event: ${eventId}`);
    const response = await fetch(
      `https://use.livegolfapi.com/v1/events/${eventId}`,
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      // Fallback to cache if available
      if (cached) {
        return {
          data: cached.data as Array<{
            player: string;
            position: number | null;
            total_score: number;
            thru: string | null;
            tee_time: string | null;
          }> | null,
          source: 'cache',
          timestamp: Date.now() - cached.age,
          error: `API error: ${response.status}`
        };
      }
      return { data: null, source: 'none', error: `API error: ${response.status}` };
    }

    const fullData = await response.json();

    console.log(`[MINIMAL] Raw API response keys:`, Object.keys(fullData));
    console.log(`[MINIMAL] Raw leaderboard type:`, typeof fullData.leaderboard, Array.isArray(fullData.leaderboard) ? 'array' : 'not array');
    console.log(`[MINIMAL] Raw leaderboard length:`, fullData.leaderboard?.length || 'no data');
    if (fullData.leaderboard && Array.isArray(fullData.leaderboard) && fullData.leaderboard.length > 0) {
      console.log(`[MINIMAL] Sample raw players:`, fullData.leaderboard.slice(0, 3).map(p => ({ name: p.player, position: p.positionValue })));
    }

    if (!fullData.leaderboard || !Array.isArray(fullData.leaderboard) || fullData.leaderboard.length === 0) {
      console.log(`[MINIMAL] No leaderboard data in API response, returning empty`);
      await writeCache(eventId, []);
      return {
        data: [],
        source: 'livegolfapi',
        timestamp: Date.now()
      };
    }

    // Extract only minimal data we need
    const minimalData = fullData.leaderboard?.map((scorecard: LiveGolfAPIScorecard) => {
      const currentRound = getCurrentRound(scorecard.rounds);
      const cleanName = scorecard.player.replace(/\s*\([^)]+\)\s*$/, '').trim();
      return {
        player: cleanName,
        position: scorecard.positionValue || null,
        total_score: parseScore(scorecard.total),
        thru: currentRound?.thru || null,
        tee_time: currentRound?.teeTime || null,
      };
    }) || [];

    console.log(`[LiveGolfAPI] ✅ Extracted minimal data: ${minimalData.length} players`);
    if (minimalData.length > 0) {
      console.log(`[MINIMAL] First 3 players:`, minimalData.slice(0, 3).map(p => p.player));
    }

    // Cache the minimal data
    await writeCache(eventId, minimalData);

    return {
      data: minimalData,
      source: 'livegolfapi',
      timestamp: Date.now()
    };

  } catch (error: any) {
    console.error('Error fetching minimal scores:', error);

    if (cached) {
      return {
        data: cached.data as Array<{
          player: string;
          position: number | null;
          total_score: number;
          thru: string | null;
          tee_time: string | null;
        }> | null,
        source: 'cache',
        timestamp: Date.now() - cached.age,
        error: error?.message
      };
    }
    return { data: null, source: 'none', error: error?.message };
  }
}

/**
 * Transform minimal LiveGolfAPI data to our format
 * Much faster since we already have clean data and minimal processing
 */
export async function transformMinimalLiveGolfAPIScores(
  minimalScores: Array<{
    player: string;
    position: number | null;
    total_score: number;
    thru: string | null;
    tee_time: string | null;
  }>,
  supabaseClient: any
): Promise<Array<{
  pgaPlayerId: string;
  playerName: string;
  total_score: number;
  today_score: number;
  thru: number | string;
  position: number | null;
  is_tied: boolean;
  tied_with_count: number;
  made_cut: boolean;
  round_1_score: number | null;
  round_2_score: number | null;
  round_3_score: number | null;
  round_4_score: number | null;
  tee_time: string | null;
  starting_tee: number | null;
}>> {
  console.log(`\n=== Transforming ${minimalScores.length} minimal scores ===`);

  // Batch lookup all players
  const playerNames = minimalScores.map(score => score.player);
  console.log(`[MINIMAL] Looking up ${playerNames.length} players:`, playerNames.slice(0, 5));

  const { data: existingPlayers } = await supabaseClient
    .from('pga_players')
    .select('id, name')
    .in('name', playerNames);

  const playerMap = new Map(
    existingPlayers?.map(player => [player.name, player.id]) || []
  );

  console.log(`[MINIMAL] Found ${playerMap.size} out of ${playerNames.length} players in database`);
  if (playerMap.size === 0 && playerNames.length > 0) {
    console.log(`[MINIMAL] No matches found. API names:`, playerNames.slice(0, 3));
    // Check what players actually exist in database
    const { data: allPlayers } = await supabaseClient
      .from('pga_players')
      .select('name')
      .limit(5);
    console.log(`[MINIMAL] Sample database players:`, allPlayers?.map(p => p.name));
  }

  // Sort by score and assign proper sequential positions
  const sortedScores = minimalScores.sort((a, b) => {
    // Sort by total score ascending (lower is better in golf), then by original position as tiebreaker
    if (a.total_score !== b.total_score) return a.total_score - b.total_score;
    return (a.position || 999) - (b.position || 999);
  });

  // Assign sequential positions and handle ties
  let currentPosition = 1;
  let currentScore = sortedScores[0]?.total_score;
  let tieCount = 1;

  for (let i = 0; i < sortedScores.length; i++) {
    const score = sortedScores[i];

    if (score.total_score === currentScore) {
      // Same score = tie
      tieCount++;
    } else {
      // Different score = new position
      currentPosition += tieCount;
      currentScore = score.total_score;
      tieCount = 1;
    }

    // Assign calculated position
    score.calculatedPosition = currentPosition;
    score.isTied = tieCount > 1;
    score.tiedCount = tieCount;
  }

  const results = sortedScores
    .map(score => {
      const pgaPlayerId = playerMap.get(score.player);
      if (!pgaPlayerId) {
        console.log(`Skipping player not in database: ${score.player}`);
        return null;
      }

      // Simple thru processing
      let thru: number | string = 0;
      if (score.thru && score.thru !== '-') {
        const parsed = parseInt(score.thru);
        if (!isNaN(parsed)) {
          thru = parsed;
        } else {
          thru = score.thru; // Keep "F" as string
        }
      }

      return {
        pgaPlayerId,
        playerName: score.player,
        total_score: score.total_score,
        today_score: score.total_score, // For round 1, today = total
        thru,
        position: score.calculatedPosition,
        is_tied: score.isTied || false,
        tied_with_count: score.tiedCount || 1,
        made_cut: score.calculatedPosition !== null && score.calculatedPosition <= 65,
        round_1_score: null, // Minimal API doesn't provide round scores
        round_2_score: null,
        round_3_score: null,
        round_4_score: null,
        tee_time: score.tee_time,
        starting_tee: null, // Minimal API doesn't provide starting tee
      };
    })
    .filter(Boolean);

  console.log(`Transformed ${results.length} valid player scores`);
  return results;
}

/**
 * Transform LiveGolfAPI scorecards to our format
 * Maps player names to our pga_player_ids
 */
/**
 * Normalize player name for matching
 * Removes qualifiers like (LQ), (SC), (NT) and normalizes special characters
 */
function normalizePlayerName(name: string): string {
  return name
    .replace(/\s*\([A-Z]{2}\)\s*$/i, '') // Remove qualifiers like (LQ), (SC), (NT)
    .toLowerCase()
    .trim()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, ''); // Remove accent marks
}

export async function transformLiveGolfAPIScores(
  scorecards: LiveGolfAPIScorecard[],
  supabaseClient: any // Supabase client to create players
): Promise<Array<{
  pgaPlayerId: string;
  playerName: string;
  total_score: number;
  today_score: number;
  thru: number | string;
  position: number | null;
  is_tied: boolean;
  tied_with_count: number;
  made_cut: boolean;
  round_1_score: number | null;
  round_2_score: number | null;
  round_3_score: number | null;
  round_4_score: number | null;
  tee_time: string | null;
  starting_tee: number | null;
}>> {
  console.log(`\n=== Transforming ${scorecards.length} scorecards ===`);

  // Deduplicate scorecards by player name, preferring ones with real data
  const deduplicatedScorecards = new Map<string, LiveGolfAPIScorecard>();

  for (const scorecard of scorecards) {
    // Strip course suffix from API player name (e.g., "Min Woo Lee (NT)" → "Min Woo Lee")
    const cleanPlayerName = scorecard.player.replace(/\s*\([^)]+\)\s*$/, '').trim();

    // Check if we already have this player
    const existing = deduplicatedScorecards.get(cleanPlayerName);

    if (!existing) {
      // First time seeing this player
      deduplicatedScorecards.set(cleanPlayerName, scorecard);
    } else {
      // We have this player already, choose the one with better data
      const existingHasData = existing.position !== null && existing.total !== null;
      const currentHasData = scorecard.position !== null && scorecard.total !== null;

      if (currentHasData && !existingHasData) {
        // Current has data, existing doesn't - use current
        deduplicatedScorecards.set(cleanPlayerName, scorecard);
      } else if (!currentHasData && existingHasData) {
        // Existing has data, current doesn't - keep existing
        // Do nothing
      } else if (currentHasData && existingHasData) {
        // Both have data - prefer the one with course suffix (more specific)
        if (scorecard.player.includes('(') && !existing.player.includes('(')) {
          deduplicatedScorecards.set(cleanPlayerName, scorecard);
        }
      }
      // If neither has data, keep the first one
    }
  }

  console.log(`After deduplication: ${deduplicatedScorecards.size} unique players`);

  // Get all player names that need to be checked
  const playerNames = Array.from(deduplicatedScorecards.values()).map(scorecard =>
    scorecard.player.replace(/\s*\([^)]+\)\s*$/, '').trim()
  );

  // Batch lookup all players at once
  const { data: existingPlayers } = await supabaseClient
    .from('pga_players')
    .select('id, name')
    .in('name', playerNames);

  const playerMap = new Map(
    existingPlayers?.map(player => [player.name, player.id]) || []
  );

  console.log(`Found ${playerMap.size} out of ${playerNames.length} players in database`);

  // Assign proper sequential positions based on ranking
  const sortedScorecards = Array.from(deduplicatedScorecards.values()).sort((a, b) => {
    // Sort by total score ascending (lower is better in golf), then by positionValue as tiebreaker
    const scoreA = parseScore(a.total);
    const scoreB = parseScore(b.total);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return (a.positionValue || 999) - (b.positionValue || 999);
  });

  // Assign sequential positions and handle ties
  let currentPosition = 1;
  let currentScore = parseScore(sortedScorecards[0]?.total);
  let tieCount = 1;

  for (let i = 0; i < sortedScorecards.length; i++) {
    const scorecard = sortedScorecards[i];
    const score = parseScore(scorecard.total);

    if (score === currentScore) {
      // Same score = tie
      tieCount++;
    } else {
      // Different score = new position
      currentPosition += tieCount;
      currentScore = score;
      tieCount = 1;
    }

    // Assign the position to the scorecard
    scorecard.calculatedPosition = currentPosition;
    scorecard.isTied = tieCount > 1;
    scorecard.tiedCount = tieCount;
  }

  const results = await Promise.all(
    sortedScorecards.map(async (scorecard, idx) => {
      // Player name was already cleaned during deduplication
      const cleanPlayerName = scorecard.player.replace(/\s*\([^)]+\)\s*$/, '').trim();

      const pgaPlayerId = playerMap.get(cleanPlayerName);
      if (!pgaPlayerId) {
        // Skip players that don't exist in our database
        console.log(`Skipping player not in database: ${scorecard.player}`);
        return null;
      }

      // Parse total score (tournament cumulative)
      const total_score = parseScore(scorecard.total);

      // Get current round for today_score and thru
      const currentRound = getCurrentRound(scorecard.rounds);
      
      // Calculate today's score based on current round
      let today_score = 0;
      if (currentRound) {
        // If round has a score/total, use it
        if (currentRound.total !== null && currentRound.total !== undefined) {
          today_score = parseScore(currentRound.total);
        } else if (currentRound.score !== null && currentRound.score !== undefined) {
          // Use actual score if available
          const score = typeof currentRound.score === 'number' ? currentRound.score : parseInt(currentRound.score);
          // Calculate relative to par (assuming par is 72 for 18 holes, 36 for 9)
          const par = currentRound.thru && !isNaN(parseInt(currentRound.thru)) ? parseInt(currentRound.thru) * 4 : 72;
          today_score = score - par;
        } else if (currentRound.round === 1) {
          // Round 1 in progress - today's score IS the tournament total
          today_score = total_score;
        } else {
          // Later rounds in progress - calculate from previous rounds
          const previousRounds = scorecard.rounds.filter(r => r.round < currentRound.round && r.score !== null);
          const previousTotal = previousRounds.reduce((sum, r) => sum + parseScore(r.total), 0);
          today_score = total_score - previousTotal;
        }
      }
      
      // Handle thru field - could be hole number, "F", or tee time
      let thru: number | string = 0;
      if (currentRound?.thru && currentRound.thru !== '-') {
        const parsed = parseInt(currentRound.thru);
        // If it's a valid number (hole), use it as number; otherwise keep as string (tee time or "F")
        if (!isNaN(parsed)) {
          thru = parsed;
        } else {
          thru = currentRound.thru; // Keep tee times or "F" as strings
        }
      }
      

      // Use calculated position instead of API position
      const position = scorecard.calculatedPosition;
      const is_tied = scorecard.isTied || scorecard.calculatedIsTied || false;
      const tied_with_count = scorecard.tiedCount || scorecard.calculatedTiedCount || 1;
      const made_cut = position !== null && position <= 65;

      // Extract round scores
      const round_1 = scorecard.rounds.find((r) => r.round === 1);
      const round_2 = scorecard.rounds.find((r) => r.round === 2);
      const round_3 = scorecard.rounds.find((r) => r.round === 3);
      const round_4 = scorecard.rounds.find((r) => r.round === 4);

      // Extract tee time and starting tee from current round (usually Round 1 has this info)
      const tee_time = currentRound?.teeTime || round_1?.teeTime || null;
      const starting_tee = currentRound?.startingTee ?? round_1?.startingTee ?? null;

      return {
        pgaPlayerId,
        playerName: cleanPlayerName,
        total_score,
        today_score,
        thru,
        position,
        is_tied,
        tied_with_count,
        made_cut,
        round_1_score: round_1?.score ?? null,
        round_2_score: round_2?.score ?? null,
        round_3_score: round_3?.score ?? null,
        round_4_score: round_4?.score ?? null,
        tee_time,
        starting_tee,
      };
    })
  );

  // Filter out null results
  const validResults = results.filter(Boolean) as any[];
  
  console.log(`=== Transformation complete: ${validResults.length} players processed ===\n`);
  return validResults;
}
