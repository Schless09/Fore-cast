import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth/profile';
import { createServiceClient } from '@/lib/supabase/service';
import { getLeagueIdForWeeklyStandings } from '@/lib/league-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/prize-money';
import { formatTimestampCST } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { TournamentSelector } from '@/components/tournaments/TournamentSelector';
import { ExpandableRosterRow } from '@/components/standings/ExpandableRosterRow';
import { LiveTeamStandings } from '@/components/standings/LiveTeamStandings';

interface WeeklyStandingsPageProps {
  params: Promise<{ tournamentId: string }>;
}

// Force fresh data on every request to prevent caching issues
export const revalidate = 0;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function WeeklyStandingsByTournamentPage({
  params,
}: WeeklyStandingsPageProps) {
  const { tournamentId } = await params;
  
  // Auth is handled by middleware
  const profile = await getProfile();
  if (!profile) {
    redirect('/auth');
  }
  
  const supabase = createServiceClient();
  const pageGeneratedAt = new Date().getTime();
  const cacheBuster = pageGeneratedAt.toString(36);

  // Get tournament first (need it for early bail)
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500">Tournament not found</p>
            <Link href="/standings/weekly" className="mt-4 inline-block">
              <Button variant="outline">Back to Weekly Standings</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pick which league to show: active if it includes this tournament, else any league user is in that includes it (so multi-league users show up)
  const userLeagueId = await getLeagueIdForWeeklyStandings(
    supabase,
    profile.id,
    tournamentId,
    profile.active_league_id
  );
  const tournamentIncludedInLeague = userLeagueId !== null;

  // Roster filter: show all league members (not just users who have this league as active)
  let leagueMemberIds: string[] = [];
  if (tournamentIncludedInLeague && userLeagueId) {
    const { data: leagueMembers } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', userLeagueId);
    leagueMemberIds = (leagueMembers || []).map((m) => m.user_id);
  }

  // Run remaining queries in parallel for faster page load (skip rosters if tournament not in league)
  const [prizeDistributionsResult, rostersResult, allTournamentsResult, teeTimeResult] = await Promise.all([
    // Get prize distributions for live calculations
    supabase
      .from('prize_money_distributions')
      .select('position, percentage, amount')
      .eq('tournament_id', tournamentId)
      .order('position', { ascending: true }),
    
    // Get rosters for all league members (not just active_league_id)
    tournamentIncludedInLeague && leagueMemberIds.length > 0
      ? supabase
          .from('user_rosters')
          .select(`
            id,
            roster_name,
            total_winnings,
            user_id,
            profiles(username),
            tournament:tournaments(name, status)
          `)
          .eq('tournament_id', tournamentId)
          .in('user_id', leagueMemberIds)
          .order('total_winnings', { ascending: false })
      : Promise.resolve({ data: tournamentIncludedInLeague ? [] : null, error: null }),
    
    // Get all tournaments for selector
    supabase
      .from('tournaments')
      .select('id, name, status, start_date')
      .order('status', { ascending: true })
      .order('start_date', { ascending: false }),
    
    // Get tee times for display round calculation
    supabase
      .from('tournament_players')
      .select('tee_time_r2, tee_time_r3, tee_time_r4')
      .eq('tournament_id', tournamentId)
      .limit(200),
  ]);

  const prizeDistributions = prizeDistributionsResult.data;
  const rosters = rostersResult.data;
  const allTournaments = allTournamentsResult.data;
  const teeTimeData = teeTimeResult.data;

  if (rostersResult.error) {
    console.error('Error loading rosters:', rostersResult.error);
  }

  // Calculate display round - switch to next round 5 hours before first tee time
  // Handle MongoDB extended JSON format {$numberInt: "1"} that may come from RapidAPI
  const rawRound = tournament.current_round as unknown;
  let displayRound = typeof rawRound === 'object' && rawRound !== null && '$numberInt' in rawRound
    ? parseInt((rawRound as { $numberInt: string }).$numberInt, 10) 
    : (typeof rawRound === 'number' ? rawRound : 1);
  if (teeTimeData && teeTimeData.length > 0 && displayRound < 4) {
    const parseTime = (timeStr: string): number => {
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!match) return 9999;
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const period = match[3].toUpperCase();
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    // Get current time in EST
    const now = new Date();
    const estFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = estFormatter.formatToParts(now);
    const estHours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const estMinutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const currentMinutes = estHours * 60 + estMinutes;

    // Helper to find earliest tee time and check if we should advance
    const findEarliestTeeTime = (teeTimes: (string | null | undefined)[]): string | null => {
      const validTimes = teeTimes.filter((t): t is string => t !== null && t !== undefined);
      if (validTimes.length === 0) return null;
      return validTimes.sort((a, b) => parseTime(a) - parseTime(b))[0];
    };

    const shouldAdvanceToRound = (earliestTeeTime: string | null): boolean => {
      if (!earliestTeeTime) return false;
      const teeTimeMinutes = parseTime(earliestTeeTime);
      const hoursUntil = (teeTimeMinutes - currentMinutes) / 60;
      return hoursUntil <= 5 && hoursUntil > -2;
    };

    // Check each round transition
    if (displayRound === 1) {
      const earliestR2 = findEarliestTeeTime(teeTimeData.map((t) => t.tee_time_r2));
      if (shouldAdvanceToRound(earliestR2)) displayRound = 2;
    }
    if (displayRound === 2) {
      const earliestR3 = findEarliestTeeTime(teeTimeData.map((t) => t.tee_time_r3));
      if (shouldAdvanceToRound(earliestR3)) displayRound = 3;
    }
    if (displayRound === 3) {
      const earliestR4 = findEarliestTeeTime(teeTimeData.map((t) => t.tee_time_r4));
      if (shouldAdvanceToRound(earliestR4)) displayRound = 4;
    }
  }

  // Check if we should use live standings (active or completed tournament with API ID)
  // For completed tournaments, the component will use stored final data instead of polling
  const useLiveStandings = (tournament.status === 'active' || tournament.status === 'completed') && tournament.rapidapi_tourn_id;

  // Get user's roster rank
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRosterIndex = rosters?.findIndex((r: any) => r.user_id === profile.id);
  const userRank = userRosterIndex !== undefined && userRosterIndex !== -1 ? userRosterIndex + 1 : null;

  // Re-sort to prioritize: active > completed (recent) > upcoming (next)
  const sortedTournaments = allTournaments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? [...allTournaments].sort((a: any, b: any) => {
        // Priority: active > completed > upcoming
        const statusPriority: Record<string, number> = {
          active: 1,
          completed: 2,
          upcoming: 3,
        };
        const aPriority = statusPriority[a.status] || 99;
        const bPriority = statusPriority[b.status] || 99;

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        // Within same status, sort by date
        if (a.status === 'upcoming') {
          // For upcoming, show next one first (ascending)
          return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        } else {
          // For active/completed, show most recent first (descending)
          return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        }
      })
    : [];

  // Determine current week's tournament from sortedTournaments (no extra query needed)
  // 1. If there's an active tournament, show that
  // 2. After Monday noon CST, show the next upcoming tournament
  // 3. Otherwise, show the most recent completed tournament
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentActive = sortedTournaments.find((t: any) => t.status === 'active');

  // Check if it's after Monday noon CST
  const isAfterMondayNoonCST = () => {
    const now = new Date();
    // Convert to CST (UTC-6)
    const cstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const dayOfWeek = cstTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = cstTime.getHours();
    
    // After Monday noon: Monday after 12pm, or any day Tuesday-Sunday
    return dayOfWeek === 1 ? hour >= 12 : dayOfWeek !== 0;
  };

  let currentWeekTournamentId;
  
  if (currentActive?.id) {
    // Active tournament takes priority
    currentWeekTournamentId = currentActive.id;
  } else if (isAfterMondayNoonCST()) {
    // After Monday noon CST: show next upcoming tournament
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentWeekTournamentId = sortedTournaments.find((t: any) => t.status === 'upcoming')?.id;
  } else {
    // Before Monday noon CST: show most recent completed tournament
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentWeekTournamentId = sortedTournaments.find((t: any) => t.status === 'completed')?.id;
  }
  
  // Fallback to first available tournament
  if (!currentWeekTournamentId && sortedTournaments.length > 0) {
    currentWeekTournamentId = sortedTournaments[0].id;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Weekly Standings</h1>
        <p className="text-gray-300">
          Tournament leaderboard ranked by total winnings
        </p>
      </div>

      {/* Tournament Selector */}
      {sortedTournaments && sortedTournaments.length > 1 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Select Tournament
              </label>
              {currentWeekTournamentId && currentWeekTournamentId !== tournamentId && (
                <Link href={`/standings/weekly/${currentWeekTournamentId}`} className="w-full sm:w-auto">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                    View Current Week →
                  </Button>
                </Link>
              )}
            </div>
            <TournamentSelector
              tournaments={sortedTournaments}
              currentTournamentId={tournamentId}
              currentWeekTournamentId={currentWeekTournamentId || null}
              basePath="/standings/weekly"
            />
            {currentWeekTournamentId === tournamentId && (
              <p className="mt-3 text-xs text-green-600 flex items-center gap-1">
                <span>⭐</span>
                <span>This is the current week&apos;s tournament</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tournament Info */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-start gap-3">
                <CardTitle className="text-lg sm:text-xl flex-1">{tournament.name}</CardTitle>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap sm:hidden ${
                    tournament.status === 'upcoming'
                      ? 'bg-blue-100 text-blue-800'
                      : tournament.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {tournament.status}
                </span>
              </div>
              {tournament.course && (
                <p className="text-xs sm:text-sm text-gray-600 mt-2">📍 {tournament.course}</p>
              )}
            </div>
            <span
              className={`hidden sm:block px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap ${
                tournament.status === 'upcoming'
                  ? 'bg-blue-100 text-blue-800'
                  : tournament.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {tournament.status}
            </span>
          </div>
        </CardHeader>
      </Card>

      {/* Standings Table - only when this tournament is included in the user's league */}
      {!tournamentIncludedInLeague ? (
        <Card className="bg-casino-card border-casino-gold/20">
          <CardContent className="py-12 text-center">
            <p className="text-casino-text font-medium mb-2">
              This tournament is not included in your league&apos;s schedule.
            </p>
            <p className="text-casino-gray text-sm">
              Team standings are only shown for tournaments that count toward your league&apos;s season. Switch leagues or select another tournament to see standings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg sm:text-xl">Team Standings</CardTitle>
                {!useLiveStandings && (
                  <p className="text-xs sm:text-sm text-casino-gray mt-1">
                    Last updated: {formatTimestampCST(pageGeneratedAt)} | Cache: {cacheBuster}
                  </p>
                )}
              </div>
              {tournament.status === 'upcoming' && (
                <div className="text-xs text-casino-gray bg-casino-card border border-casino-gold/20 px-3 py-1 rounded-md whitespace-nowrap self-start">
                  🔒 Rosters locked until tournament starts
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {useLiveStandings ? (
              <LiveTeamStandings
                tournamentId={tournamentId}
                liveGolfAPITournamentId={tournament.rapidapi_tourn_id}
                prizeDistributions={(prizeDistributions || []).map((p) => ({
                  position: p.position,
                  amount: p.amount || 0,
                }))}
                currentUserId={profile.id}
                tournamentStatus={tournament.status}
                userLeagueId={userLeagueId || undefined}
                leagueMemberIds={leagueMemberIds}
                displayRound={displayRound}
              />
            ) : rosters && rosters.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-casino-gold/30">
                        <th className="px-1 sm:px-2 py-1.5 text-left text-xs font-medium text-casino-gray uppercase tracking-wider">
                          Rank
                        </th>
                        <th className="px-1 sm:px-2 py-1.5 text-left text-xs font-medium text-casino-gray uppercase tracking-wider">
                          Team
                        </th>
                        <th className="px-1 sm:px-2 py-1.5 text-right text-xs font-medium text-casino-gray uppercase tracking-wider">
                          Winnings
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {rosters.map((roster: any, index: number) => {
                        const isUserRoster = roster.user_id === profile.id;

                        return (
                          <ExpandableRosterRow
                            key={`${roster.id}-${cacheBuster}`}
                            roster={roster}
                            index={index}
                            isUserRoster={isUserRoster}
                            tournamentId={tournamentId}
                            tournamentStatus={tournament.status}
                            currentUserId={profile.id}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(tournament.status === 'active' || tournament.status === 'completed') && (
                  <p className="text-xs text-casino-gray mt-4 flex items-center gap-1">
                    <span>💡</span>
                    <span>Click the arrow next to a team to view their full roster</span>
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-casino-gray mb-4">No rosters submitted yet for this tournament.</p>
                <Link href={`/tournaments/${tournamentId}`}>
                  <Button>Create Your Roster</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* User's Rank Summary - Only show when tournament is in league and non-live standings (live has its own) */}
      {tournamentIncludedInLeague && !useLiveStandings && userRank && (
        <Card className="mt-6 border-2 border-casino-green/30">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div>
                <p className="text-xs sm:text-sm text-casino-gray mb-1">Your Rank</p>
                <p className="text-xl sm:text-2xl font-bold text-casino-gold font-orbitron">
                  #{userRank} <span className="text-base sm:text-xl text-casino-gray-dark">of {rosters?.length || 0}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs sm:text-sm text-casino-gray mb-1">Your Winnings</p>
                <p className="text-xl sm:text-2xl font-bold text-casino-green font-orbitron">
                  {formatCurrency(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    rosters?.find((r: any) => r.user_id === profile.id)?.total_winnings || 0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Back to Leaderboard Link */}
      <div className="mt-8 flex justify-center">
        <Link href={`/tournaments/${tournamentId}`}>
          <Button variant="ghost">← Back to Live Leaderboard</Button>
        </Link>
      </div>
    </div>
  );
}
