import type { SupabaseClient } from '@supabase/supabase-js';
import { isTournamentIncludedInLeague } from '@/lib/league-utils';

const TOP_PAID_PLACES = 4;

export interface WouldaCouldaPlayerWinnings {
  name: string;
  winnings: number;
}

export interface WouldaCouldaRecipient {
  userId: string;
  rosterId: string;
  tournamentId: string;
  currentTotalWinnings: number;
  wouldBeTotalWinnings: number;
  wouldBePlayerWinnings: WouldaCouldaPlayerWinnings[];
  wouldBeRank: number;
  currentRank: number;
  leagueId: string;
  tournamentName: string;
  username: string | null;
  email: string;
}

/**
 * Get league IDs that include this tournament and where the user is a member.
 */
async function getLeaguesIncludingTournament(
  supabase: SupabaseClient,
  userId: string,
  tournamentId: string
): Promise<string[]> {
  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId);
  if (!memberships?.length) return [];

  const leagueIds = [...new Set(memberships.map((m) => m.league_id))];
  const included: string[] = [];
  for (const leagueId of leagueIds) {
    const ok = await isTournamentIncludedInLeague(supabase, leagueId, tournamentId);
    if (ok) included.push(leagueId);
  }
  return included;
}

/**
 * Standings for one league: roster ids (or user_id + total_winnings) sorted by total_winnings desc.
 * Returns list of { user_id, roster_id, total_winnings } for league members who have a roster.
 */
async function getLeagueStandingsForTournament(
  supabase: SupabaseClient,
  leagueId: string,
  tournamentId: string
): Promise<{ user_id: string; roster_id: string; total_winnings: number }[]> {
  const { data: memberIds } = await supabase
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId);
  if (!memberIds?.length) return [];

  const userIds = memberIds.map((m) => m.user_id);
  const { data: rosters } = await supabase
    .from('user_rosters')
    .select('id, user_id, total_winnings')
    .eq('tournament_id', tournamentId)
    .in('user_id', userIds);
  if (!rosters?.length) return [];

  const withTotal = (rosters || []).map((r) => ({
    user_id: r.user_id,
    roster_id: r.id,
    total_winnings: Number(r.total_winnings ?? 0),
  }));
  withTotal.sort((a, b) => b.total_winnings - a.total_winnings);
  return withTotal;
}

/**
 * Compute would-be total winnings for a roster version (sum of prize_money for those tournament_players).
 */
async function getWouldBeTotalForVersion(
  supabase: SupabaseClient,
  versionId: string
): Promise<number> {
  const { playerWinnings } = await getWouldBePlayerWinningsForVersion(supabase, versionId);
  return playerWinnings.reduce((sum, p) => sum + p.winnings, 0);
}

/**
 * Get player names and prize money for a roster version (for email display).
 */
export async function getWouldBePlayerWinningsForVersion(
  supabase: SupabaseClient,
  versionId: string
): Promise<{ playerWinnings: WouldaCouldaPlayerWinnings[]; total: number }> {
  const { data: versionPlayers } = await supabase
    .from('roster_version_players')
    .select('tournament_player_id')
    .eq('roster_version_id', versionId);
  if (!versionPlayers?.length) return { playerWinnings: [], total: 0 };

  const tpIds = versionPlayers.map((p) => p.tournament_player_id);
  const { data: tps } = await supabase
    .from('tournament_players')
    .select('id, prize_money, pga_players(name)')
    .in('id', tpIds);
  const playerWinnings: WouldaCouldaPlayerWinnings[] = (tps || []).map((tp) => {
    const pga = tp.pga_players as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(pga) ? pga[0]?.name : pga?.name;
    return {
      name: name ?? 'Unknown',
      winnings: Number(tp.prize_money ?? 0),
    };
  });
  const total = playerWinnings.reduce((sum, p) => sum + p.winnings, 0);
  return { playerWinnings, total };
}

/**
 * Find users who edited their roster, would have finished in the money (top 4) with a previous lineup,
 * but their current lineup scored worse. Returns one recipient per (user, tournament, league) with
 * the best "woulda" scenario for that league.
 */
export async function getWouldaCouldaRecipients(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<WouldaCouldaRecipient[]> {
  // Rosters that have at least one version for this tournament
  const { data: versions } = await supabase
    .from('roster_versions')
    .select('id, roster_id, user_id')
    .eq('tournament_id', tournamentId);
  if (!versions?.length) return [];

  const rosterIdsWithVersions = [...new Set(versions.map((v) => v.roster_id))];
  const versionIdsByRoster = new Map<string, string[]>();
  for (const v of versions) {
    const list = versionIdsByRoster.get(v.roster_id) ?? [];
    list.push(v.id);
    versionIdsByRoster.set(v.roster_id, list);
  }

  const { data: rosters } = await supabase
    .from('user_rosters')
    .select('id, user_id, total_winnings')
    .eq('tournament_id', tournamentId)
    .in('id', rosterIdsWithVersions);
  if (!rosters?.length) return [];

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('name')
    .eq('id', tournamentId)
    .single();
  const tournamentName = tournament?.name ?? 'Tournament';

  const recipients: WouldaCouldaRecipient[] = [];

  for (const roster of rosters) {
    const currentTotal = Number(roster.total_winnings ?? 0);
    const versionIds = versionIdsByRoster.get(roster.id) ?? [];
    let maxWouldBe = 0;
    let bestVersionId: string | null = null;
    for (const vid of versionIds) {
      const w = await getWouldBeTotalForVersion(supabase, vid);
      if (w > maxWouldBe) {
        maxWouldBe = w;
        bestVersionId = vid;
      }
    }
    if (maxWouldBe <= currentTotal || !bestVersionId) continue;

    const leagueIds = await getLeaguesIncludingTournament(
      supabase,
      roster.user_id,
      tournamentId
    );
    for (const leagueId of leagueIds) {
      const standings = await getLeagueStandingsForTournament(
        supabase,
        leagueId,
        tournamentId
      );
      const currentIdx = standings.findIndex((s) => s.roster_id === roster.id);
      if (currentIdx < 0) continue;
      const currentRank = currentIdx + 1;

      const wouldBeStandings = standings.map((s) =>
        s.roster_id === roster.id
          ? { ...s, total_winnings: maxWouldBe }
          : s
      );
      wouldBeStandings.sort((a, b) => b.total_winnings - a.total_winnings);
      const wouldBeIdx = wouldBeStandings.findIndex((s) => s.roster_id === roster.id);
      const wouldBeRank = wouldBeIdx < 0 ? currentRank : wouldBeIdx + 1;

      // Send if the previous lineup would have placed them strictly higher (in the money when they weren't, or higher when they were)
      if (wouldBeRank < currentRank) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, username')
          .eq('id', roster.user_id)
          .single();
        if (profile?.email) {
          const { playerWinnings: wouldBePlayerWinnings } =
            await getWouldBePlayerWinningsForVersion(supabase, bestVersionId);
          recipients.push({
            userId: roster.user_id,
            rosterId: roster.id,
            tournamentId,
            currentTotalWinnings: currentTotal,
            wouldBeTotalWinnings: maxWouldBe,
            wouldBePlayerWinnings: wouldBePlayerWinnings.sort((a, b) => b.winnings - a.winnings),
            wouldBeRank,
            currentRank,
            leagueId,
            tournamentName,
            username: profile.username ?? null,
            email: profile.email,
          });
          break; // one league scenario per roster is enough
        }
      }
    }
  }

  // One email per user (in case they're in multiple leagues that all qualified)
  const byUser = new Map<string, WouldaCouldaRecipient>();
  for (const r of recipients) {
    const existing = byUser.get(r.userId);
    if (!existing || r.wouldBeRank < existing.wouldBeRank)
      byUser.set(r.userId, r);
  }
  return [...byUser.values()];
}
