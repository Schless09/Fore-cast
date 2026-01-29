import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth/profile';
import { createServiceClient } from '@/lib/supabase/service';
import { RosterSection } from '@/components/roster/RosterSection';
import { PersonalLeaderboard } from '@/components/leaderboard/PersonalLeaderboard';
import { LivePersonalLeaderboard } from '@/components/leaderboard/LivePersonalLeaderboard';
import { LiveLeaderboard } from '@/components/leaderboard/LiveLeaderboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TournamentSelector } from '@/components/tournaments/TournamentSelector';
import { LiveRoundBadge } from '@/components/tournaments/LiveRoundBadge';
import { LineupCountdown } from '@/components/ui/LineupCountdown';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { formatCurrency } from '@/lib/prize-money';

// No more mapping needed - rapidapi_tourn_id now stores the RapidAPI tournId directly (e.g., "002", "004")

interface TournamentPageProps {
  params: Promise<{ id: string }>;
}

// Types for data from various sources
interface RosterPlayerData {
  tournament_player?: {
    pga_player_id?: string;
    pga_player?: { name: string };
    [key: string]: unknown;
  };
  player_winnings?: number;
  fantasy_points?: number;
  [key: string]: unknown;
}

interface CachedLeaderboardPlayer {
  positionValue?: number;
  playerId?: string;
  firstName?: string;
  lastName?: string;
  total?: string | number;
  toPar?: number;
  holesPlayed?: number;
  currentRoundScore?: string | number;
  thru?: string;
  player?: string;
  teeTime?: string;
  earnings?: number;
}

interface RapidAPILeaderboardPlayer {
  position?: string;
  playerId?: string;
  firstName?: string;
  lastName?: string;
  total?: string | number;
  thru?: string;
  round?: number;
  money?: number;
  currentRoundScore?: string | number;
  teeTime?: string;
}

interface PrizeDistribution {
  position: number | string;
  amount: number;
  total_purse?: number;
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

  // Get tournament first (need it for early bail)
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

  // Run remaining queries in parallel for faster page load
  const [allTournamentsResult, existingRosterResult, teeTimeResult] = await Promise.all([
    // Get all tournaments for selector
    supabase
      .from('tournaments')
      .select('id, name, status, start_date')
      .order('start_date', { ascending: false }),
    
    // Check if user has an existing roster for this tournament
    supabase
      .from('user_rosters')
      .select(`
        *,
        roster_players(
          *,
          tournament_player:tournament_players(
            *,
            pga_player:pga_players(*)
          )
        )
      `)
      .eq('user_id', profile.id)
      .eq('tournament_id', id)
      .maybeSingle(),
    
    // Get tee times for all players (for countdown and leaderboard display)
    supabase
      .from('tournament_players')
      .select('tee_time_r1, tee_time_r2, starting_tee_r1, starting_tee_r2, pga_players(name)')
      .eq('tournament_id', id)
      .limit(200),
  ]);

  const allTournaments = allTournamentsResult.data;
  const existingRoster = existingRosterResult.data;
  const teeTimeData = teeTimeResult.data;

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

  // Get roster players if roster exists
  let existingRosterData = null;
  if (existingRoster) {
    // Sort roster players by winnings (descending), then by fantasy points as tiebreaker
    const sortedRosterPlayers = (existingRoster.roster_players || [])
      .map((rp: RosterPlayerData) => ({
        ...rp,
        tournament_player: rp.tournament_player || {},
      }))
      .sort((a: RosterPlayerData, b: RosterPlayerData) => {
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
        .map((rp: RosterPlayerData) => rp.tournament_player?.pga_player_id)
        .filter(Boolean),
    };
  }
  
  // Parse and find earliest tee time + build tee time map for leaderboard
  let earliestTeeTime: string | undefined;
  const teeTimeMap = new Map<string, { tee_time_r1: string | null; tee_time_r2: string | null; starting_tee_r1: number | null; starting_tee_r2: number | null }>();
  
  if (teeTimeData && teeTimeData.length > 0) {
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
    
    // Build tee time map for leaderboard display
    interface TeeTimeRow {
      tee_time_r1: string | null;
      tee_time_r2: string | null;
      starting_tee_r1: number | null;
      starting_tee_r2: number | null;
      pga_players: { name: string } | null;
    }
    
    teeTimeData.forEach((t) => {
      const row = t as unknown as TeeTimeRow;
      const pga = row.pga_players as unknown as { name: string } | null;
      if (pga?.name) {
        teeTimeMap.set(pga.name, {
          tee_time_r1: row.tee_time_r1,
          tee_time_r2: row.tee_time_r2,
          starting_tee_r1: row.starting_tee_r1,
          starting_tee_r2: row.starting_tee_r2,
        });
      }
    });
    
    // Find earliest tee time for countdown
    const teeTimes = teeTimeData
      .map((t) => (t as unknown as TeeTimeRow).tee_time_r1)
      .filter((t): t is string => t !== null);
    
    if (teeTimes.length > 0) {
      earliestTeeTime = teeTimes.sort((a, b) => parseTime(a) - parseTime(b))[0];
    }
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
  let leaderboardSource: 'database' | 'rapidapi' | 'cache' | 'none' = 'none';

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
    // Get prize distributions first
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

    // Helper to calculate prize money with proper tie handling
    const calculateTiePrizeMoney = (position: number | null, tieCount: number): number => {
      if (!position || position < 1 || tieCount < 1) return 0;
      let totalPrize = 0;
      for (let i = 0; i < tieCount; i++) {
        const pos = position + i;
        const dist = prizeDistributionMap.get(pos);
        totalPrize += dist?.amount || 0;
      }
      return Math.round(totalPrize / tieCount);
    };

    // PRIORITY 1: Check live_scores_cache (where RapidAPI data is stored)
    // Query by tournament_id directly - this is how auto-sync stores the data
    const { data: cachedData } = await supabase
      .from('live_scores_cache')
      .select('data, updated_at, tournament_status, current_round, player_count')
      .eq('tournament_id', id)
      .single();
    
    if (cachedData?.data?.data && Array.isArray(cachedData.data.data) && cachedData.data.data.length > 0) {
        leaderboardSource = 'cache';
        
        const scores = cachedData.data.data;
        
        // Count players at each position to detect ties
        const positionCounts = new Map<number, number>();
        scores.forEach((player: CachedLeaderboardPlayer) => {
          const posNum = player.positionValue;
          if (posNum && posNum > 0 && posNum < 900) {
            positionCounts.set(posNum, (positionCounts.get(posNum) || 0) + 1);
          }
        });

        tournamentLeaderboard = scores.map((player: CachedLeaderboardPlayer) => {
          const posNum = player.positionValue;
          const actualPosition = (posNum && posNum < 900) ? posNum : null;
          const tieCount = actualPosition ? (positionCounts.get(actualPosition) || 1) : 1;
          const isTied = tieCount > 1;

          return {
            position: actualPosition,
            is_tied: isTied,
            tied_with_count: tieCount,
            total_score: parseScore(player.total ?? 0),
            today_score: player.currentRoundScore ? parseScore(player.currentRoundScore) : 0,
            thru: player.thru || 'F',
            prize_money: calculateTiePrizeMoney(actualPosition, tieCount),
            name: player.player || 'Unknown',
            tee_time: player.teeTime || null,
            starting_tee: null,
            prize_distribution: actualPosition && prizeDistributionMap.has(actualPosition)
              ? prizeDistributionMap.get(actualPosition)
              : undefined,
          };
        });
        
        // Sort by position
        tournamentLeaderboard.sort((a, b) => {
          if (a.position === null && b.position === null) return 0;
          if (a.position === null) return 1;
          if (b.position === null) return -1;
          return a.position - b.position;
        });
    }

    // PRIORITY 2: Try database tournament_players if no cache data
    if (tournamentLeaderboard.length === 0) {
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

      if (!dbError && leaderboardData && leaderboardData.length > 0) {
        leaderboardSource = 'database';
        tournamentLeaderboard =
          leaderboardData.map((row) => {
            const pga = row.pga_players as unknown as { name: string } | null;
            return {
              position: row.position ?? null,
              is_tied: row.is_tied ?? false,
              tied_with_count: row.tied_with_count ?? 1,
              total_score: row.total_score ?? 0,
              today_score: row.today_score ?? 0,
              thru: row.thru ?? '-',
              prize_money: row.prize_money ?? 0,
              name: pga?.name || 'Unknown',
              prize_distribution:
                row.position && prizeDistributionMap.has(row.position)
                  ? prizeDistributionMap.get(row.position)
                  : undefined,
            };
          }) || [];
      }
    }

    // PRIORITY 3: Fetch fresh from RapidAPI if still no data
    // rapidapi_tourn_id now stores the RapidAPI tournId directly (e.g., "002", "004")
    if (tournamentLeaderboard.length === 0 && tournament.rapidapi_tourn_id) {
      try {
        const tournId = tournament.rapidapi_tourn_id;
        const year = new Date(tournament.start_date).getFullYear().toString();
        const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com';
        const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
        
        const response = await fetch(
          `https://${RAPIDAPI_HOST}/leaderboard?year=${year}&tournId=${tournId}`,
          {
            headers: {
              'X-RapidAPI-Host': RAPIDAPI_HOST,
              'X-RapidAPI-Key': RAPIDAPI_KEY,
            },
            cache: 'no-store',
          }
        );

        if (response.ok) {
          const json = await response.json();
          const leaderboard = json.leaderboardRows || [];
          
          if (leaderboard.length > 0) {
            leaderboardSource = 'rapidapi';
            
            // Count positions for ties
            const positionCounts = new Map<number, number>();
            leaderboard.forEach((player: RapidAPILeaderboardPlayer) => {
              const posNum = parseInt(player.position?.replace('T', '') || '') || null;
              if (posNum && posNum > 0) {
                positionCounts.set(posNum, (positionCounts.get(posNum) || 0) + 1);
              }
            });

            tournamentLeaderboard = leaderboard.map((player: RapidAPILeaderboardPlayer) => {
              const posNum = parseInt(player.position?.replace('T', '') || '') || null;
              const tieCount = posNum ? (positionCounts.get(posNum) || 1) : 1;
              const isTied = tieCount > 1;

              return {
                position: posNum,
                is_tied: isTied,
                tied_with_count: tieCount,
                total_score: parseScore(player.total ?? 0),
                today_score: player.currentRoundScore ? parseScore(player.currentRoundScore) : 0,
                thru: player.thru || 'F',
                prize_money: calculateTiePrizeMoney(posNum, tieCount),
                name: `${player.firstName} ${player.lastName}`,
                tee_time: player.teeTime || null,
                starting_tee: null,
                prize_distribution: posNum && prizeDistributionMap.has(posNum)
                  ? prizeDistributionMap.get(posNum)
                  : undefined,
              };
            });
          }
        }
      } catch (error) {
        console.error('Error fetching from RapidAPI:', error);
      }
    }

    // If still no data, set source to none
    if (tournamentLeaderboard.length === 0) {
      leaderboardSource = 'none';
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
    
    allPlayers?.forEach((tp) => {
      const pga = tp.pga_players as unknown as { name: string } | null;
      if (pga?.name) {
        const name = pga.name;
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
                  {prizeDistributions.slice(0, 20).map((dist: PrizeDistribution, idx: number) => (
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
            {tournament.rapidapi_tourn_id && leaderboardSource === 'none' && (
              <p className="text-sm text-casino-gray">
                Unable to fetch data from RapidAPI. Please try again later or contact support.
              </p>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <CardTitle className="text-lg sm:text-xl">
                {tournament.status === 'active' ? 'Live Leaderboard' : 'Final Leaderboard'}
              </CardTitle>
              {tournament.status === 'active' && existingRoster && (
                <p className="text-xs text-casino-green mt-1">
                  ⭐ Your players are highlighted
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <LiveLeaderboard
            initialData={tournamentLeaderboard}
            tournamentId={id}
            prizeDistributions={prizeDistributions}
            userRosterPlayerIds={userRosterPlayerIds}
            playerNameToIdMap={playerNameToIdMap}
            liveGolfAPITournamentId={tournament.rapidapi_tourn_id}
            tournamentStatus={tournament.status}
            currentRound={tournament.current_round}
            teeTimeMap={teeTimeMap}
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
                  tournament.rapidapi_tourn_id ? (
                    <LiveRoundBadge 
                      liveGolfAPITournamentId={tournament.rapidapi_tourn_id}
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

      {/* Lineup Countdown - shows for upcoming tournaments */}
      {tournament.status === 'upcoming' && (
        <div className="mb-6 flex justify-center">
          <LineupCountdown
            startDate={tournament.start_date}
            earliestTeeTime={earliestTeeTime}
            status={tournament.status}
          />
        </div>
      )}

      {/* Roster Section - shows summary with edit option, or builder for new rosters */}
      {showRosterBuilder && (
        <RosterSection
          tournamentId={id}
          tournamentStatus={tournament.status}
          existingRoster={existingRosterData ? {
            id: existingRosterData.id,
            roster_name: existingRosterData.roster_name,
            budget_spent: existingRosterData.budget_spent,
            budget_limit: existingRosterData.budget_limit,
            roster_players: existingRosterData.roster_players,
            playerIds: existingRosterData.playerIds,
          } : undefined}
        />
      )}

      {/* Show personal leaderboard for active tournaments */}
      {showPersonalLeaderboard && existingRosterData && (
        <div className="mb-6">
          {tournament.status === 'active' && tournament.rapidapi_tourn_id ? (
            <LivePersonalLeaderboard
              rosterId={existingRosterData.id}
              rosterName={existingRosterData.roster_name}
              tournamentName={tournament.name}
              liveGolfAPITournamentId={tournament.rapidapi_tourn_id}
              prizeDistributions={(prizeDistributions || []).map((p: PrizeDistribution) => ({
                position: typeof p.position === 'string' ? parseInt(p.position, 10) : p.position,
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
      <div className="mt-8 flex justify-center">
        <Link href="/standings/weekly">
          <Button variant="ghost">← Back to Weekly Standings</Button>
        </Link>
      </div>
    </div>
  );
}
