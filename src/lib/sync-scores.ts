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
 * Sync scores and positions from ESPN cache to tournament_players.
 * Uses espn_cache keyed by tournament_id. Matches by espn_athlete_id (playerId) or name.
 */
export async function syncTournamentScoresFromESPN(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<SyncScoresResult> {
  console.log(`[SYNC] 🔄 Starting ESPN sync for tournament: ${tournamentId}`);

  const { data: cached, error } = await supabase
    .from('espn_cache')
    .select('data, updated_at')
    .eq('tournament_id', tournamentId)
    .single();

  if (error || !cached?.data?.data || !Array.isArray(cached.data.data)) {
    return {
      success: false,
      message: `No ESPN cache found for tournament ${tournamentId}. Ensure espn_event_id is set and espn-sync has run.`,
      error: 'NO_ESPN_CACHE',
    };
  }

  const cacheAge = Math.round((Date.now() - new Date(cached.updated_at).getTime()) / 1000);
  console.log(`[SYNC] Found ${cached.data.data.length} players in ESPN cache (${cacheAge}s old)`);

  const result = await syncPositionsFromCachedData(
    supabase,
    tournamentId,
    cached.data.data as CachedScoreData[],
    { source: 'espn' }
  );

  if (result.success) {
    return {
      success: true,
      message: `Synced ${result.playersUpdated} player positions from ESPN cache`,
      playersUpdated: result.playersUpdated,
      source: 'espn_cache',
    };
  }

  return {
    success: false,
    message: 'Failed to sync positions from ESPN cache',
    error: 'SYNC_FAILED',
  };
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
    cached.data.data as CachedScoreData[],
    { source: 'rapidapi' }
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
  'st lee': 'seung taek lee',
};

/**
 * Normalize a name for matching: lowercase, remove accents, transliterate Nordic chars.
 * Collapses initial patterns (e.g. "S.T.", "S. T.", "ST") so "S.T. Lee" matches "ST Lee".
 * Examples: "Ludvig Åberg" → "ludvig aberg", "S.T. Lee" → "st lee"
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

  // Collapse initial patterns: "s.t.", "s. t.", "s t" → "st" so "S.T. Lee" matches "ST Lee"
  normalized = normalized.replace(/(\b([a-z]\.?\s*)+)/g, (match, _p1, offset, fullStr) => {
    const letters = match.replace(/[.\s]/g, '').toLowerCase();
    const nextIdx = offset + match.length;
    const nextChar = fullStr[nextIdx];
    return letters + (nextChar && /[a-z]/.test(nextChar) ? ' ' : '');
  });

  // Apply nickname mapping if exists
  return NICKNAME_MAP[normalized] || normalized;
}

interface SyncPositionsOptions {
  source: 'espn' | 'rapidapi';
}

/**
 * Sync positions from cached live scores data to tournament_players.
 * Handles name matching with accent normalization for international players.
 * For ESPN: also matches by pga_players.espn_athlete_id to score.playerId.
 */
async function syncPositionsFromCachedData(
  supabase: SupabaseClient,
  tournamentId: string,
  cachedData: CachedScoreData[],
  options: SyncPositionsOptions
): Promise<{ success: boolean; playersUpdated: number }> {
  const select = options.source === 'espn'
    ? 'id, pga_player_id, pga_players(name, espn_athlete_id)'
    : 'id, pga_player_id, pga_players(name)';

  const { data: tournamentPlayers, error: tpError } = await supabase
    .from('tournament_players')
    .select(select)
    .eq('tournament_id', tournamentId);

  if (tpError || !tournamentPlayers) {
    console.error('[SYNC] Error loading tournament players for cache sync:', tpError);
    return { success: false, playersUpdated: 0 };
  }

  const normalizedNameToId = new Map<string, string>();
  const playerIdToTPId = new Map<string, string>();
  const espnAthleteIdToTPId = new Map<string, string>();
  const tpIdToPgaPlayerId = new Map<string, string>();

  for (const tp of tournamentPlayers) {
    const pgaPlayer = tp.pga_players as { name?: string; espn_athlete_id?: string } | null;
    if (pgaPlayer?.name) {
      const normalized = normalizeName(pgaPlayer.name);
      normalizedNameToId.set(normalized, tp.id);
    }
    if (tp.pga_player_id) {
      playerIdToTPId.set(tp.pga_player_id, tp.id);
    }
    if (options.source === 'espn' && pgaPlayer?.espn_athlete_id) {
      espnAthleteIdToTPId.set(String(pgaPlayer.espn_athlete_id), tp.id);
    }
    if (tp.pga_player_id) {
      tpIdToPgaPlayerId.set(tp.id, tp.pga_player_id);
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

  const updates: Array<{
    id: string;
    position: number | null;
    is_tied: boolean;
    total_score: number | null;
    is_amateur?: boolean;
  }> = [];

  for (const score of cachedData) {
    let tpId: string | undefined;
    if (options.source === 'espn' && score.playerId) {
      tpId = espnAthleteIdToTPId.get(score.playerId);
    }
    if (!tpId) {
      tpId = playerIdToTPId.get(score.playerId);
    }
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
        is_amateur: score.isAmateur,
      });
    } else if (!tpId && score.positionValue !== null && score.positionValue <= 70) {
      // Log unmatched players who finished in money positions
      console.log(`[SYNC] ⚠️ Unmatched player: "${score.player}" (pos ${score.positionValue})`);
    }
  }

  console.log(`[SYNC] Matched ${updates.length} players from cached data`);

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

      // Persist ESPN amateur status to pga_players for final winnings calculation
      if (
        options.source === 'espn' &&
        update.is_amateur !== undefined &&
        tpIdToPgaPlayerId.has(update.id)
      ) {
        const pgaId = tpIdToPgaPlayerId.get(update.id)!;
        await supabase
          .from('pga_players')
          .update({ is_amateur: update.is_amateur })
          .eq('id', pgaId);
      }
    }
  }

  return { success: updates.length > 0, playersUpdated: updates.length };
}
