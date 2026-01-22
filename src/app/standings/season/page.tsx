import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/prize-money';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { logger } from '@/lib/logger';

interface SeasonStanding {
  user_id: string;
  username: string;
  total_winnings: number;
  tournaments_played: number;
  rosters: Array<{
    roster_name: string;
    tournament_name: string;
    winnings: number;
  }>;
}

interface RosterData {
  id: string;
  user_id: string;
  roster_name: string;
  total_winnings: number;
  profiles?: {
    username: string;
  } | null;
  tournament?: {
    id: string;
    name: string;
    status: string;
    start_date: string;
  } | null;
}

interface SupabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
}

// Revalidate page every 3 minutes
export const revalidate = 180;

export default async function SeasonStandingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get user's active league
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('active_league_id')
    .eq('id', user.id)
    .single();

  const userLeagueId = userProfile?.active_league_id;

  // Get all completed rosters with winnings
  // Note: We need to filter by tournament status, so we'll get tournaments first
  const { data: tournaments, error: tournamentsError } = await supabase
    .from('tournaments')
    .select('id')
    .in('status', ['completed', 'active']);

  if (tournamentsError) {
    logger.error('Error loading tournaments for season standings', {
      errorMessage: tournamentsError.message,
      errorCode: tournamentsError.code,
    }, tournamentsError as Error);
  }

  const tournamentIds = tournaments?.map(t => t.id) || [];

  // Only query rosters if we have tournaments
  let rosters: RosterData[] = [];
  let rostersError: SupabaseError | null = null;

  if (tournamentIds.length > 0) {
    const result = await supabase
      .from('user_rosters')
      .select(
        `
        id,
        user_id,
        roster_name,
        total_winnings,
        profiles!inner(username, active_league_id),
        tournament:tournaments(id, name, status, start_date)
      `
      )
      .in('tournament_id', tournamentIds)
      .eq('profiles.active_league_id', userLeagueId)
      .order('created_at', { ascending: false });

    rosters = (result.data as unknown as RosterData[]) || [];
    rostersError = result.error as SupabaseError | null;
  }

  if (rostersError) {
    logger.error('Error loading rosters for season standings', {
      errorMessage: rostersError.message,
      errorCode: rostersError.code,
      errorDetails: rostersError.details,
      errorHint: rostersError.hint,
    }, rostersError);
  }

  // Aggregate winnings by user
  const standingsMap = new Map<string, SeasonStanding>();

  // Sort rosters by tournament start_date manually since we can't order by nested field
  const sortedRosters = [...rosters].sort((a: RosterData, b: RosterData) => {
    const aDate = a.tournament?.start_date || '';
    const bDate = b.tournament?.start_date || '';
    return bDate.localeCompare(aDate); // Most recent first
  });

  sortedRosters.forEach((roster: RosterData) => {
    const userId = roster.user_id;
    const username = roster.profiles?.username || 'Unknown';
    const winnings = roster.total_winnings || 0;
    const tournamentName = roster.tournament?.name || 'Unknown Tournament';

    if (!standingsMap.has(userId)) {
      standingsMap.set(userId, {
        user_id: userId,
        username,
        total_winnings: 0,
        tournaments_played: 0,
        rosters: [],
      });
    }

    const standing = standingsMap.get(userId)!;
    standing.total_winnings += winnings;
    standing.tournaments_played += 1;
    standing.rosters.push({
      roster_name: roster.roster_name,
      tournament_name: tournamentName,
      winnings,
    });
  });

  // Convert to array and sort by total winnings
  const standings = Array.from(standingsMap.values()).sort(
    (a, b) => b.total_winnings - a.total_winnings
  );

  // Find user's rank
  const userStandingIndex = standings.findIndex((s) => s.user_id === user.id);
  const userRank = userStandingIndex !== -1 ? userStandingIndex + 1 : null;
  const userStanding = userStandingIndex !== -1 ? standings[userStandingIndex] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-linear-to-r from-casino-gold to-casino-gold-light bg-clip-text text-transparent mb-2">Season Standings</h1>
        <p className="text-casino-gray">
          Cumulative winnings across all tournaments this season
        </p>
      </div>

      {/* User's Season Summary */}
      {userStanding && (
        <Card className="mb-6 border-2 border-casino-green/30">
          <CardHeader>
            <CardTitle>Your Season Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-casino-gray mb-1">Season Rank</p>
                <p className="text-3xl font-bold text-casino-gold font-orbitron">
                  #{userRank} <span className="text-xl text-casino-gray-dark">of {standings.length}</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-casino-gray mb-1">Total Winnings</p>
                <p className="text-3xl font-bold text-casino-green font-orbitron">
                  {formatCurrency(userStanding.total_winnings)}
                </p>
              </div>
              <div>
                <p className="text-sm text-casino-gray mb-1">Tournaments Played</p>
                <p className="text-3xl font-bold text-casino-text font-orbitron">
                  {userStanding.tournaments_played}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Season Standings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Season Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {standings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Player
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Winnings
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Tournaments
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Avg. Winnings
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((standing, index) => {
                    const rank = index + 1;
                    const isUser = standing.user_id === user.id;
                    const avgWinnings =
                      standing.tournaments_played > 0
                        ? standing.total_winnings / standing.tournaments_played
                        : 0;

                    return (
                      <tr
                        key={standing.user_id}
                        className={`border-b border-gray-200 transition-colors ${
                          isUser
                            ? 'bg-green-50 hover:bg-green-100'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-2 sm:px-4 py-3 sm:py-4">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <span className="text-xs sm:text-sm font-medium text-gray-900">
                              {rank}
                            </span>
                            {rank === 1 && (
                              <span className="text-base sm:text-lg">🏆</span>
                            )}
                            {isUser && (
                              <span className="px-1.5 sm:px-2 py-0.5 bg-green-200 text-green-800 rounded text-xs font-medium">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-3 sm:py-4">
                          <span className="font-medium text-gray-900 text-xs sm:text-sm">
                            {standing.username}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-3 sm:py-4 text-right">
                          <span className="font-semibold text-green-600 text-xs sm:text-sm">
                            {formatCurrency(standing.total_winnings)}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-3 sm:py-4 text-center text-xs sm:text-sm text-gray-600 hidden sm:table-cell">
                          {standing.tournaments_played}
                        </td>
                        <td className="px-2 sm:px-4 py-3 sm:py-4 text-right text-xs sm:text-sm text-gray-600 hidden md:table-cell">
                          {formatCurrency(avgWinnings)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-casino-gray mb-4">
                No completed tournaments yet. Check back after tournaments finish!
              </p>
              <Link href="/tournaments">
                <Button>Browse Tournaments</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User's Tournament Breakdown */}
      {userStanding && userStanding.rosters.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Your Tournament Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userStanding.rosters
                .sort((a, b) => b.winnings - a.winnings)
                .map((roster, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-casino-card/50 border border-casino-gold/10 rounded-lg hover:border-casino-gold/30 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-casino-text">{roster.roster_name}</p>
                      <p className="text-sm text-casino-gray">{roster.tournament_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-casino-green font-orbitron">
                        {formatCurrency(roster.winnings)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
