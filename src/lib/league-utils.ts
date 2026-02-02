import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A league is "included in season standings" if it has at least one tournament
 * that is not excluded. Leagues with no league_tournaments config are included by default.
 */
export async function isLeagueIncludedInSeasonStandings(
  supabase: SupabaseClient,
  leagueId: string | null
): Promise<boolean> {
  if (!leagueId) return false;

  const { data: rows } = await supabase
    .from('league_tournaments')
    .select('is_excluded')
    .eq('league_id', leagueId);

  if (!rows || rows.length === 0) return true;
  return rows.some((r) => r.is_excluded === false);
}

/**
 * Whether this tournament is included in the given league (not excluded in league_tournaments).
 * If the league has no row for this tournament, it's included by default.
 * If leagueId is null, returns true (show standings).
 */
export async function isTournamentIncludedInLeague(
  supabase: SupabaseClient,
  leagueId: string | null,
  tournamentId: string
): Promise<boolean> {
  if (!leagueId) return true;

  const { data: row } = await supabase
    .from('league_tournaments')
    .select('is_excluded')
    .eq('league_id', leagueId)
    .eq('tournament_id', tournamentId)
    .maybeSingle();

  if (!row) return true;
  return row.is_excluded === false;
}

/**
 * Filter a list of tournaments to only those included in the given league.
 * Uses one batch query. If leagueId is null, returns all tournaments unchanged.
 */
export async function filterTournamentsIncludedInLeague<T extends { id: string }>(
  supabase: SupabaseClient,
  leagueId: string | null,
  tournaments: T[]
): Promise<T[]> {
  if (!leagueId || tournaments.length === 0) return tournaments;

  const { data: rows } = await supabase
    .from('league_tournaments')
    .select('tournament_id, is_excluded')
    .eq('league_id', leagueId)
    .in('tournament_id', tournaments.map((t) => t.id));

  const excludedIds = new Set(
    (rows || []).filter((r) => r.is_excluded === true).map((r) => r.tournament_id)
  );
  return tournaments.filter((t) => !excludedIds.has(t.id));
}
