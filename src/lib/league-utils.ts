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

/**
 * For weekly standings: pick which league to show for this user and tournament.
 * Prefer the user's active league if it includes the tournament; otherwise any
 * league the user is in that includes the tournament. Ensures multi-league users
 * (e.g. derranic) show up in the league where the tourney IS included.
 */
export async function getLeagueIdForWeeklyStandings(
  supabase: SupabaseClient,
  userId: string,
  tournamentId: string,
  activeLeagueId: string | null
): Promise<string | null> {
  // Prefer active league if it includes this tournament
  if (activeLeagueId) {
    const activeIncluded = await isTournamentIncludedInLeague(
      supabase,
      activeLeagueId,
      tournamentId
    );
    if (activeIncluded) return activeLeagueId;
  }

  // Else find any league the user is in that includes this tournament
  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId);

  if (!memberships?.length) return null;

  const leagueIds = [...new Set(memberships.map((m) => m.league_id))];
  for (const leagueId of leagueIds) {
    const included = await isTournamentIncludedInLeague(supabase, leagueId, tournamentId);
    if (included) return leagueId;
  }
  return null;
}
