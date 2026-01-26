import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth/profile';
import { createServiceClient } from '@/lib/supabase/service';
import { RosterBuilder } from '@/components/roster/RosterBuilder';
import { PersonalLeaderboard } from '@/components/leaderboard/PersonalLeaderboard';
import { LivePersonalLeaderboard } from '@/components/leaderboard/LivePersonalLeaderboard';
import { LiveLeaderboard } from '@/components/leaderboard/LiveLeaderboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TournamentSelector } from '@/components/tournaments/TournamentSelector';
import { LiveRoundBadge } from '@/components/tournaments/LiveRoundBadge';
import Link from 'next/link';
import { formatDate, formatScore, getScoreColor, formatTimestampCST } from '@/lib/utils';
import { formatCurrency } from '@/lib/prize-money';
import { fetchScoresFromLiveGolfAPI } from '@/lib/livegolfapi';

interface TournamentPageProps {
  params: Promise<{ id: string }>;
}


// Force fresh data on every request to prevent caching issues
export const revalidate = 0;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function TournamentPage({ params }: TournamentPageProps) {
  const { id } = await params;
  
  // Auth is handled by middleware, get profile for user-specific data
  const profile = await getProfile();
  if (!profile) {
    redirect('/auth');
  }
  
  const supabase = createServiceClient();

  // Add timestamp for debugging revalidation and cache busting
  const pageGeneratedAt = new Date().getTime();
  const cacheBuster = Math.random().toString(36).substring(7);

  // Get tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();

  if (tournamentError || !tournament) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-600">Tournament not found</p>
            <Link href="/tournaments" className="mt-4 inline-block">
              <Button variant="outline">Back to Tournaments</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get all tournaments for selector
  const { data: allTournaments } = await supabase
    .from('tournaments')
    .select('id, name, status, start_date')
    .order('start_date', { ascending: false });

  // Sort tournaments: active first, then upcoming (by date), then completed (recent first)
  const sortedTournaments = allTournaments
    ? [...allTournaments].sort((a, b) => {
        const statusPriority: Record<string, number> = {
          active: 0,
          upcoming: 1,
          completed: 2,
        };
        const aPriority = statusPriority[a.status] ?? 3;
        const bPriority = statusPriority[b.status] ?? 3;
        
        if (aPriority !== bPriority) return aPriority - bPriority;
        
        if (a.status === 'upcoming') return a.start_date.localeCompare(b.start_date);
        return b.start_date.localeCompare(a.start_date);
      })
    : [];

  // Find current week tournament (active tournament)
  const currentWeekTournament = sortedTournaments.find((t) => t.status === 'active');

  // Check if user has an existing roster for this tournament
  const { data: existingRoster } = await supabase
    .from('user_rosters')
    .select(
      `
      *,
      roster_players(
        *,
        tournament_player:tournament_players(
          *,
          pga_player:pga_players(*)
        )
      )
    `
    )
    .eq('user_id', profile.id)
    .eq('tournament_id', id)
    .maybeSingle();

  // Get roster players if roster exists
  let existingRosterData = null;
  if (existingRoster) {
    // Sort roster players by winnings (descending), then by fantasy points as tiebreaker
    const sortedRosterPlayers = (existingRoster.roster_players || [])
      .map((rp: any) => ({
        ...rp,
        tournament_player: rp.tournament_player || {},
      }))
      .sort((a: any, b: any) => {
        const aWinnings = a.player_winnings || 0;
        const bWinnings = b.player_winnings || 0;
        if (aWinnings !== bWinnings) {
          return bWinnings - aWinnings;
        }
        return (b.fantasy_points || 0) - (a.fantasy_points || 0);
      });

    existingRosterData = {
      ...existingRoster,
      roster_players: sortedRosterPlayers,
      playerIds: sortedRosterPlayers
        .map((rp: any) => rp.tournament_player?.pga_player_id)
        .filter(Boolean),
    };
  }

  // Determine what to show
  // - Upcoming: roster builder
  // - Active: roster builder if no roster yet; live leaderboard if roster exists
  // - Completed: golfer leaderboard (regardless of user's roster)
  const showRosterBuilder =
    tournament.status === 'upcoming' ||
    (tournament.status === 'active' && !existingRoster);
  const showPersonalLeaderboard =
    tournament.status === 'active' && !!existingRoster;
  const showGolferLeaderboard = tournament.status === 'completed' || (tournament.status === 'active' && !!existingRoster);

  // Load tournament leaderboard (golfers) for completed tournaments
  type PrizeDistributionRow = {
    position: number;
    percentage: number | null;
    amount: number;
    total_purse: number;
  };

  type LeaderboardRow = {
    position: number | null;
    is_tied: boolean;
    tied_with_count: number;
    total_score: number;
    today_score: number;
    thru: string | number;
    prize_money: number;
    name: string;
    tee_time?: string | null;
    starting_tee?: number | null;
    prize_distribution?: PrizeDistributionRow;
  };

  let prizeDistributionMap = new Map<number, PrizeDistributionRow>();
  let prizeDistributions: PrizeDistributionRow[] = [];

  let tournamentLeaderboard: LeaderboardRow[] = [];
  let leaderboardSource: 'database' | 'livegolfapi' | 'cache' | 'none' = 'none';
  let lastUpdated: number | null = null;

  // Helper to parse LiveGolfAPI scores
  const parseScore = (score: string | number | null): number => {
    if (score === null || score === undefined) return 0;
    if (typeof score === 'number') return score;
    if (score === 'E') return 0;
    const s = score.toString().trim();
    if (s.startsWith('+')) return parseInt(s.slice(1), 10) || 0;
    return parseInt(s, 10) || 0;
  };

  if (tournament.status === 'completed' || (tournament.status === 'active' && existingRoster)) {
    // Try database first
    const { data: leaderboardData, error: dbError } = await supabase
      .from('tournament_players')
      .select(
        `
        position,
        is_tied,
        tied_with_count,
        total_score,
        today_score,
        thru,
        prize_money,
        pga_players ( name )
      `
      )
      .eq('tournament_id', id)
      .not('position', 'is', null)
      .order('position', { ascending: true });

    // Prize money calculation is now handled manually by admin via the prize money page
    // This prevents glitching and ensures calculations happen when explicitly requested

    const { data: prizeDistributionsData } = await supabase
      .from('prize_money_distributions')
      .select('position, percentage, amount, total_purse')
      .eq('tournament_id', id)
      .order('position', { ascending: true });

    prizeDistributions = prizeDistributionsData || [];

    if (prizeDistributions.length > 0) {
      prizeDistributionMap = new Map(
        prizeDistributions.map((dist) => [
          dist.position,
          {
            position: dist.position,
            percentage: dist.percentage,
            amount: dist.amount,
            total_purse: dist.total_purse,
          },
        ])
      );
    }

    if (!dbError && leaderboardData && leaderboardData.length > 0) {
      leaderboardSource = 'database';

      // Prize money calculation is now handled manually by admin via the prize money page
      // This prevents glitching and ensures calculations happen when explicitly requested

      tournamentLeaderboard =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        leaderboardData.map((row: any) => ({
          position: row.position ?? null,
          is_tied: row.is_tied ?? false,
          tied_with_count: row.tied_with_count ?? 1,
          total_score: row.total_score ?? 0,
          today_score: row.today_score ?? 0,
          thru: row.thru ?? '-',
          prize_money: row.prize_money ?? 0,
          name: row.pga_players?.name || 'Unknown',
          prize_distribution:
            row.position && prizeDistributionMap.has(row.position)
              ? prizeDistributionMap.get(row.position)
              : undefined,
        })) || [];
    } else if (tournament.livegolfapi_event_id) {
      // Fallback to LiveGolfAPI if no DB data
      try {
        const result = await fetchScoresFromLiveGolfAPI(
          tournament.livegolfapi_event_id
        );
        const scores = result.data;
        lastUpdated = result.timestamp || null;

        if (!scores || !Array.isArray(scores) || scores.length === 0) {
          // No data available from API or cache - show empty state
          console.warn('LiveGolfAPI unavailable:', result.error || 'No data returned');
          leaderboardSource = 'none';
          tournamentLeaderboard = [];
        } else {
          leaderboardSource = result.source === 'cache' ? 'cache' : 'livegolfapi';

          // First pass: count players at each position to detect ties
          const positionCounts = new Map<number, number>();
          scores.forEach((scorecard: any) => {
            const position = scorecard.positionValue >= 980 ? null : scorecard.positionValue;
            if (position && position > 0) {
              positionCounts.set(position, (positionCounts.get(position) || 0) + 1);
            }
          });
          
          // Helper to calculate prize money with proper tie handling
          const calculateTiePrizeMoney = (position: number | null, tieCount: number): number => {
            if (!position || position < 1 || tieCount < 1) return 0;
            
            // Sum prize money for positions position through position + tieCount - 1
            let totalPrize = 0;
            for (let i = 0; i < tieCount; i++) {
              const pos = position + i;
              const dist = prizeDistributionMap.get(pos);
              totalPrize += dist?.amount || 0;
            }
            
            // Split evenly among tied players
            return Math.round(totalPrize / tieCount);
          };

          tournamentLeaderboard =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            scores.map((scorecard: any) => {
            const rounds = scorecard.rounds || [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentRound = rounds.reduce((acc: any, r: any) => {
              if (!acc || (r.round || 0) > (acc.round || 0)) return r;
              return acc;
            }, null);

            const actualPosition =
              scorecard.positionValue >= 980 ? null : scorecard.positionValue;
            
            const tieCount = actualPosition ? (positionCounts.get(actualPosition) || 1) : 1;
            const isTied = tieCount > 1;

            // Handle thru field - could be hole number "9", "18", "F", or tee time
            let thruValue = '-';
            if (currentRound?.thru && currentRound.thru !== '-') {
              const parsed = parseInt(currentRound.thru);
              // If it's a number (hole), use it; if "F", show finished; otherwise it's likely a tee time
              if (!isNaN(parsed)) {
                thruValue = currentRound.thru;
              } else if (currentRound.thru === 'F') {
                thruValue = 'F';
              } else {
                // Likely a tee time like "6:09 PM" or "5:58 PM"
                thruValue = currentRound.thru;
              }
            }

            // Calculate prize money with proper tie handling
            const calculatedPrizeMoney = calculateTiePrizeMoney(actualPosition, tieCount);

            return {
              position: actualPosition,
              is_tied: isTied,
              tied_with_count: tieCount,
              total_score: parseScore(scorecard.total),
              today_score: currentRound ? parseScore(currentRound.total) : 0,
              thru: thruValue,
              prize_money: calculatedPrizeMoney,
              name: scorecard.player || 'Unknown',
              tee_time: currentRound?.teeTime || null,
              starting_tee: currentRound?.startingTee || null,
              prize_distribution:
                actualPosition && prizeDistributionMap.has(actualPosition)
                  ? prizeDistributionMap.get(actualPosition)
                  : undefined,
            };
          }) || [];
        }
      } catch (error) {
        // Log error but don't crash - gracefully fall back to empty state
        console.error('Error fetching scores from LiveGolfAPI:', error);
        leaderboardSource = 'none';
        tournamentLeaderboard = [];
      }
    } else {
      leaderboardSource = 'none';
      tournamentLeaderboard = [];
    }
  }

  // Get player IDs on user's roster for highlighting  
  const userRosterPlayerIds = existingRosterData?.playerIds || [];
  
  // Create a map of player names to IDs from tournament_players for highlighting
  const playerNameToIdMap = new Map<string, string>();
  if ((tournament.status === 'active' || tournament.status === 'completed') && (existingRoster || tournament.status === 'completed')) {
    const { data: allPlayers } = await supabase
      .from('tournament_players')
      .select('pga_player_id, pga_players(name)')
      .eq('tournament_id', id);
    
    allPlayers?.forEach((tp: any) => {
      if (tp.pga_players?.name) {
        const name = tp.pga_players.name;
        playerNameToIdMap.set(name.toLowerCase().trim(), tp.pga_player_id);
        // Also add normalized version
        const normalized = name.toLowerCase().trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        playerNameToIdMap.set(normalized, tp.pga_player_id);
      }
    });
  }

  const renderTournamentLeaderboard = () => {
    if (tournamentLeaderboard.length === 0) {
      // If no player data but we have prize money distribution, show the prize structure
      if (prizeDistributions && prizeDistributions.length > 0) {
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">
                Prize Money Structure
              </CardTitle>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-casino-gray mt-2">
                <span>Total Purse: {formatCurrency(prizeDistributions[0]?.total_purse || 0)}</span>
                <span className="text-casino-green">
                  Tournament starts soon - leaderboard will update with live scores
                </span>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
                    <th className="px-2 sm:px-4 py-2">Pos</th>
                    <th className="px-2 sm:px-4 py-2 text-right">Prize</th>
                  </tr>
                </thead>
                <tbody>
                  {prizeDistributions.slice(0, 20).map((dist: any, idx: number) => (
                    <tr key={idx} className="border-b border-casino-gold/10">
                      <td className="px-2 sm:px-4 py-2 font-medium text-casino-text text-xs sm:text-sm">
                        {dist.position}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-right text-casino-text text-xs sm:text-sm">
                        {formatCurrency(dist.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      }

      return (
        <Card>
          <CardContent className="py-8 text-center text-casino-gray">
            <p className="mb-2">No leaderboard data available for this tournament.</p>
            {tournament.livegolfapi_event_id && leaderboardSource === 'none' && (
              <p className="text-sm text-casino-gray">
                Unable to fetch data from LiveGolfAPI. Please try again later or contact support.
              </p>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
              <CardTitle className="text-lg sm:text-xl">
                {tournament.status === 'active' ? 'Live Leaderboard' : 'Final Leaderboard'}
                <div className="text-xs text-casino-gray mt-1">
                  Tournament: {tournament.name} (ID: {id})
                </div>
              </CardTitle>
          {tournament.status === 'active' && existingRoster && (
            <p className="text-sm text-casino-green mt-2">
              ⭐ Your players are highlighted below
            </p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-casino-gray mt-2">
            <span>
              Source:{' '}
              {leaderboardSource === 'database'
                ? 'Database'
                : leaderboardSource === 'cache'
                ? 'Cache'
                : leaderboardSource === 'livegolfapi'
                ? 'LiveGolfAPI'
                : 'Unknown'} | Cache: {cacheBuster}
            </span>
            <span className="text-casino-gray">
              Page generated: {formatTimestampCST(pageGeneratedAt)}
            </span>
            {lastUpdated && (
              <span className="text-casino-gray">
                Data updated: {formatTimestampCST(lastUpdated)} ({Math.round((Date.now() - lastUpdated) / 1000 / 60)} minutes ago)
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <LiveLeaderboard
            initialData={tournamentLeaderboard}
            tournamentId={id}
            prizeDistributions={prizeDistributions}
            userRosterPlayerIds={userRosterPlayerIds}
            playerNameToIdMap={playerNameToIdMap}
            liveGolfAPITournamentId={tournament.livegolfapi_event_id}
          />
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Tournament Selector */}
      {sortedTournaments && sortedTournaments.length > 1 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <label className="block text-sm font-medium text-casino-gray">
                Select Tournament
              </label>
              {currentWeekTournament && currentWeekTournament.id !== id && (
                <Link href={`/tournaments/${currentWeekTournament.id}`} className="w-full sm:w-auto">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                    View Current Week →
                  </Button>
                </Link>
              )}
            </div>
            <TournamentSelector
              tournaments={sortedTournaments}
              currentTournamentId={id}
              currentWeekTournamentId={currentWeekTournament?.id || null}
              basePath="/tournaments"
            />
            {currentWeekTournament?.id === id && (
              <p className="mt-3 text-xs text-casino-green flex items-center gap-1">
                <span>⭐</span>
                <span>This is the current week&apos;s tournament</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tournament Header */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-start gap-3">
                <CardTitle className="text-xl sm:text-2xl flex-1">{tournament.name}</CardTitle>
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
                <p className="text-gray-600 mt-2 text-sm">📍 {tournament.course}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-600">
                <span>
                  {formatDate(tournament.start_date)} -{' '}
                  {formatDate(tournament.end_date)}
                </span>
                {tournament.status === 'active' && (
                  tournament.livegolfapi_event_id ? (
                    <LiveRoundBadge 
                      liveGolfAPITournamentId={tournament.livegolfapi_event_id}
                      fallbackRound={tournament.current_round || 1}
                    />
                  ) : (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      Round {tournament.current_round}/4
                    </span>
                  )
                )}
              </div>
            </div>
            <span
              className={`hidden sm:block px-4 py-2 rounded-full text-sm font-medium capitalize whitespace-nowrap ${
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

      {/* Roster Builder or Leaderboard */}
      {showRosterBuilder && (
        <RosterBuilder
          tournamentId={id}
          existingRoster={existingRosterData || undefined}
        />
      )}

      {/* Show personal leaderboard for active tournaments */}
      {showPersonalLeaderboard && existingRosterData && (
        <div className="mb-6">
          {tournament.status === 'active' && tournament.livegolfapi_event_id ? (
            <LivePersonalLeaderboard
              rosterId={existingRosterData.id}
              rosterName={existingRosterData.roster_name}
              tournamentName={tournament.name}
              liveGolfAPITournamentId={tournament.livegolfapi_event_id}
              prizeDistributions={(prizeDistributions || []).map((p: any) => ({
                position: p.position,
                amount: p.amount || 0,
              }))}
            />
          ) : (
            <PersonalLeaderboard
              rosterId={existingRosterData.id}
              initialRoster={existingRosterData}
            />
          )}
        </div>
      )}

      {/* Show full tournament leaderboard */}
      {showGolferLeaderboard && (
        <div className="space-y-6">
          {renderTournamentLeaderboard()}
        </div>
      )}

      {/* Links */}
      <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-between">
        <Link href="/tournaments" className="w-full sm:w-auto">
          <Button variant="ghost" className="w-full sm:w-auto">← Back to Tournaments</Button>
        </Link>
        {(tournament.status === 'active' || tournament.status === 'completed') && (
          <Link href="/standings/weekly" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">View Weekly Standings</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
