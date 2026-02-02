import type { SupabaseClient } from '@supabase/supabase-js';

export interface SyncScoresResult {
  success: boolean;
  message: string;
  playersUpdated?: number;
  source?: string;
  error?: string;
}

interface CachedScoreData {
  player: string;
  playerId: string;
  position: string;
  positionValue: number | null;
  total: string;
  thru: string;
  isAmateur?: boolean;
}

/**
 * Sync scores and positions from the Supabase cache (populated by RapidAPI cron) 
 * to the tournament_players table. This ensures positions are populated before
 * calculating winnings.
 */
export async function syncTournamentScores(
  supabase: SupabaseClient,
  tournamentId: string,
  rapidApiTournId: string
): Promise<SyncScoresResult> {
  console.log(`[SYNC] 🔄 Starting sync for tournament: ${tournamentId}`);

  // Get tournament year for cache key
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('start_date')
    .eq('id', tournamentId)
    .single();

  if (!tournament?.start_date) {
    return {
      success: false,
      message: 'Tournament not found or missing start_date',
      error: 'NO_TOURNAMENT',
    };
  }

  const year = new Date(tournament.start_date).getFullYear();
  const cacheKey = `${year}-${rapidApiTournId}`;

  console.log(`[SYNC] Looking for cache key: ${cacheKey}`);

  // Read from the live_scores_cache (populated by RapidAPI cron job)
  const { data: cached } = await supabase
    .from('live_scores_cache')
    .select('data, updated_at')
    .eq('cache_key', cacheKey)
    .single();

  if (!cached?.data?.data || !Array.isArray(cached.data.data)) {
    return {
      success: false,
      message: `No cached scores found for cache key: ${cacheKey}. Run the auto-sync cron first.`,
      error: 'NO_CACHE_DATA',
    };
  }

  const cacheAge = Math.round((Date.now() - new Date(cached.updated_at).getTime()) / 1000);
  console.log(`[SYNC] Found ${cached.data.data.length} players in cache (${cacheAge}s old)`);

  const positionResult = await syncPositionsFromCachedData(
    supabase,
    tournamentId,
    cached.data.data as CachedScoreData[]
  );

  if (positionResult.success) {
    return {
      success: true,
      message: `Synced ${positionResult.playersUpdated} player positions from RapidAPI cache`,
      playersUpdated: positionResult.playersUpdated,
      source: 'rapidapi_cache',
    };
  }

  return {
    success: false,
    message: 'Failed to sync positions from cache',
    error: 'SYNC_FAILED',
  };
}

/**
 * Common nickname → canonical name mappings for golfers.
 * Format: lowercase nickname → lowercase canonical name
 */
const NICKNAME_MAP: Record<string, string> = {
  'dan brown': 'daniel brown',
  'johnny keefer': 'john keefer',
  'matti schmid': 'matthias schmid',
  'matt kuchar': 'matthew kuchar',
  'jt poston': 'j.t. poston',
  'si woo kim': 'si-woo kim',
  'sung jae im': 'sungjae im',
  'byeong hun an': 'byeong-hun an',
  'k.h. lee': 'kyoung-hoon lee',
  'kh lee': 'kyoung-hoon lee',
  'ct pan': 'c.t. pan',
  'hj kim': 'h.j. kim',
};

/**
 * Normalize a name for matching: lowercase, remove accents, transliterate Nordic chars.
 * Examples: "Ludvig Åberg" → "ludvig aberg", "Nicolai Højgaard" → "nicolai hojgaard"
 */
function normalizeName(name: string): string {
  let normalized = name
    .toLowerCase()
    .trim()
    // Transliterate Nordic/special characters that NFD doesn't handle
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/å/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ä/g, 'a')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/ñ/g, 'n')
    // NFD normalization for remaining accented characters (é, ó, etc.)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove combining marks
    .replace(/\s+/g, ' '); // Normalize whitespace
  
  // Apply nickname mapping if exists
  return NICKNAME_MAP[normalized] || normalized;
}

/**
 * Sync positions from cached live scores data to tournament_players.
 * Handles name matching with accent normalization for international players.
 */
async function syncPositionsFromCachedData(
  supabase: SupabaseClient,
  tournamentId: string,
  cachedData: CachedScoreData[]
): Promise<{ success: boolean; playersUpdated: number }> {
  // Get all tournament_players with their pga_player names for matching
  const { data: tournamentPlayers, error: tpError } = await supabase
    .from('tournament_players')
    .select('id, pga_player_id, pga_players(name)')
    .eq('tournament_id', tournamentId);

  if (tpError || !tournamentPlayers) {
    console.error('[SYNC] Error loading tournament players for cache sync:', tpError);
    return { success: false, playersUpdated: 0 };
  }

  // Create a map of player name (normalized) to tournament_player id
  const normalizedNameToId = new Map<string, string>();
  const playerIdToTPId = new Map<string, string>();
  
  for (const tp of tournamentPlayers) {
    const pgaPlayer = tp.pga_players as { name?: string } | null;
    if (pgaPlayer?.name) {
      const normalized = normalizeName(pgaPlayer.name);
      normalizedNameToId.set(normalized, tp.id);
    }
    if (tp.pga_player_id) {
      playerIdToTPId.set(tp.pga_player_id, tp.id);
    }
  }

  // Helper to parse score string to number (e.g., "-15" → -15, "E" → 0, "+3" → 3)
  const parseScoreToNumber = (scoreStr: string): number | null => {
    if (!scoreStr || scoreStr === '-') return null;
    if (scoreStr === 'E') return 0;
    const cleaned = scoreStr.trim();
    if (cleaned.startsWith('+')) return parseInt(cleaned.slice(1), 10);
    if (cleaned.startsWith('-')) return parseInt(cleaned, 10);
    return parseInt(cleaned, 10) || null;
  };

  // Prepare updates from cached data
  const updates: Array<{ id: string; position: number | null; is_tied: boolean; total_score: number | null }> = [];
  
  for (const score of cachedData) {
    // Try to match by playerId first, then by normalized name
    let tpId = playerIdToTPId.get(score.playerId);
    
    if (!tpId && score.player) {
      const normalized = normalizeName(score.player);
      tpId = normalizedNameToId.get(normalized);
    }
    
    if (tpId && score.positionValue !== null) {
      const isTied = score.position?.startsWith('T') || false;
      const totalScore = parseScoreToNumber(score.total);
      updates.push({
        id: tpId,
        position: score.positionValue,
        is_tied: isTied,
        total_score: totalScore,
      });
    } else if (!tpId && score.positionValue !== null && score.positionValue <= 70) {
      // Log unmatched players who finished in money positions
      console.log(`[SYNC] ⚠️ Unmatched player: "${score.player}" (pos ${score.positionValue})`);
    }
  }

  console.log(`[SYNC] Matched ${updates.length} players from cached data`);

  // Update tournament_players with positions and scores
  if (updates.length > 0) {
    for (const update of updates) {
      const { error } = await supabase
        .from('tournament_players')
        .update({ 
          position: update.position, 
          is_tied: update.is_tied,
          total_score: update.total_score,
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.id);

      if (error) {
        console.error('[SYNC] Error updating player position:', error);
      }
    }
  }

  return { success: updates.length > 0, playersUpdated: updates.length };
}
