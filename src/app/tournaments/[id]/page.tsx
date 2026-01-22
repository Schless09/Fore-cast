import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RosterBuilder } from '@/components/roster/RosterBuilder';
import { PersonalLeaderboard } from '@/components/leaderboard/PersonalLeaderboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TournamentSelector } from '@/components/tournaments/TournamentSelector';
import Link from 'next/link';
import { formatDate, formatScore, getScoreColor, formatTimestampCST } from '@/lib/utils';
import { formatCurrency } from '@/lib/prize-money';
import { fetchScoresFromLiveGolfAPI } from '@/lib/livegolfapi';

interface TournamentPageProps {
  params: Promise<{ id: string }>;
}

// Revalidate page every 3 minutes to prevent excessive API calls
// This works in conjunction with the LiveGolfAPI cache layer
export const revalidate = 180;

export default async function TournamentPage({ params }: TournamentPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

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
      id,
      roster_name,
      roster_players(
        tournament_player:tournament_players(
          pga_player_id
        )
      )
    `
    )
    .eq('user_id', user.id)
    .eq('tournament_id', id)
    .maybeSingle();

  // Get roster players if roster exists
  let existingRosterData = null;
  if (existingRoster) {
    const playerIds =
      existingRoster.roster_players?.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (rp: any) => rp.tournament_player?.pga_player_id
      ).filter(Boolean) || [];

    existingRosterData = {
      id: existingRoster.id,
      rosterName: existingRoster.roster_name,
      playerIds,
    };
  }

  // Determine what to show
  // - Upcoming: roster builder
  // - Active: roster builder if no roster yet; personal leaderboard if roster exists
  // - Completed: golfer leaderboard (regardless of user's roster)
  const showRosterBuilder =
    tournament.status === 'upcoming' ||
    (tournament.status === 'active' && !existingRoster);
  const showPersonalLeaderboard =
    tournament.status === 'active' && !!existingRoster;
  const showGolferLeaderboard = tournament.status === 'completed';

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
    thru: number;
    prize_money: number;
    name: string;
    tee_time?: string | null;
    starting_tee?: number | null;
    prize_distribution?: PrizeDistributionRow;
  };

  let prizeDistributionMap = new Map<number, PrizeDistributionRow>();

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

  if (tournament.status === 'completed') {
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
      .order('position', { ascending: true });

    const { data: prizeDistributions } = await supabase
      .from('prize_money_distributions')
      .select('position, percentage, amount, total_purse')
      .eq('tournament_id', id)
      .order('position', { ascending: true });

    if (prizeDistributions) {
      prizeDistributionMap = new Map(
        prizeDistributions.map((dist) => [
          dist.position,
          {
            position: dist.position,
            percentage: dist.percentage,
            amount: parseFloat(dist.amount),
            total_purse: parseFloat(dist.total_purse),
          },
        ])
      );
    }

    if (!dbError && leaderboardData && leaderboardData.length > 0) {
      leaderboardSource = 'database';
      tournamentLeaderboard =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        leaderboardData.map((row: any) => ({
          position: row.position ?? null,
          is_tied: row.is_tied ?? false,
          tied_with_count: row.tied_with_count ?? 1,
          total_score: row.total_score ?? 0,
          today_score: row.today_score ?? 0,
          thru: row.thru ?? 0,
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

            return {
              position: actualPosition,
              is_tied:
                typeof scorecard.position === 'string' &&
                scorecard.position.startsWith('T'),
              tied_with_count: 1,
              total_score: parseScore(scorecard.total),
              today_score: currentRound ? parseScore(currentRound.total) : 0,
              thru:
                currentRound && currentRound.thru !== '-'
                  ? parseInt(currentRound.thru) || 0
                  : 0,
              prize_money: 0,
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

  const renderTournamentLeaderboard = () => {
    if (tournamentLeaderboard.length === 0) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-gray-300">
            <p className="mb-2">No leaderboard data available for this tournament.</p>
            {tournament.livegolfapi_event_id && leaderboardSource === 'none' && (
              <p className="text-sm text-gray-400">
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
          <CardTitle className="text-lg sm:text-xl">Leaderboard (Golfers)</CardTitle>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 mt-2">
            <span>
              Source:{' '}
              {leaderboardSource === 'database'
                ? 'Database'
                : leaderboardSource === 'cache'
                ? 'Cache'
                : leaderboardSource === 'livegolfapi'
                ? 'LiveGolfAPI'
                : 'Unknown'}
            </span>
            {lastUpdated && (
              <span className="text-gray-600">
                Last updated: {formatTimestampCST(lastUpdated)}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 uppercase text-xs">
              <th className="px-2 sm:px-4 py-2">Pos</th>
              <th className="px-2 sm:px-4 py-2">Golfer</th>
              <th className="px-2 sm:px-4 py-2">Total</th>
              <th className="px-2 sm:px-4 py-2">Today</th>
              <th className="px-2 sm:px-4 py-2 hidden sm:table-cell">Thru</th>
              <th className="px-2 sm:px-4 py-2 hidden lg:table-cell">Tee</th>
              <th className="px-2 sm:px-4 py-2 text-right hidden md:table-cell">%</th>
              <th className="px-2 sm:px-4 py-2 text-right">Prize</th>
            </tr>
            </thead>
            <tbody>
              {tournamentLeaderboard.map((row, idx) => {
                const name = row.name || 'Unknown';
                const pos = row.position
                  ? `${row.is_tied ? 'T' : ''}${row.position}`
                  : 'CUT';
                const totalClass = getScoreColor(row.total_score);
                const todayClass = getScoreColor(row.today_score);
                const percentage =
                  row.prize_distribution?.percentage !== null &&
                  row.prize_distribution?.percentage !== undefined
                    ? `${row.prize_distribution.percentage.toFixed(3)}%`
                    : '-';
                return (
                  <tr
                    key={`${row.position}-${name}-${idx}`}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-2 sm:px-4 py-2 font-medium text-gray-900 text-xs sm:text-sm">{pos}</td>
                    <td className="px-2 sm:px-4 py-2 text-gray-900 text-xs sm:text-sm">{name}</td>
                    <td className={`px-2 sm:px-4 py-2 font-semibold text-xs sm:text-sm ${totalClass}`}>
                      {formatScore(row.total_score)}
                    </td>
                    <td className={`px-2 sm:px-4 py-2 text-xs sm:text-sm ${todayClass}`}>
                      {formatScore(row.today_score)}
                    </td>
                    <td className="px-2 sm:px-4 py-2 text-gray-700 text-xs sm:text-sm hidden sm:table-cell">
                      {row.thru ? row.thru : '-'}
                    </td>
                    <td className="px-2 sm:px-4 py-2 text-gray-600 text-xs sm:text-sm hidden lg:table-cell">
                      {row.tee_time ? new Date(row.tee_time).toLocaleTimeString('en-US', { 
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                        // Uses user's local timezone automatically
                      }) : '-'}
                    </td>
                    <td className="px-2 sm:px-4 py-2 text-right text-gray-900 text-xs sm:text-sm hidden md:table-cell">
                      {percentage}
                    </td>
                    <td className="px-2 sm:px-4 py-2 text-right text-gray-900 text-xs sm:text-sm">
                      {formatCurrency(
                        row.prize_money ||
                          row.prize_distribution?.amount ||
                          0
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    Round {tournament.current_round}/4
                  </span>
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

      {showGolferLeaderboard ? (
        <div className="space-y-6">
          {renderTournamentLeaderboard()}
        </div>
      ) : (
        showPersonalLeaderboard &&
        existingRoster && (
          <div className="space-y-6">
            <PersonalLeaderboard rosterId={existingRoster.id} />
          </div>
        )
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
