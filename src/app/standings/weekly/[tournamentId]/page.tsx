import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/prize-money';
import { formatTimestampCST } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { TournamentSelector } from '@/components/tournaments/TournamentSelector';
import { ExpandableRosterRow } from '@/components/standings/ExpandableRosterRow';

interface WeeklyStandingsPageProps {
  params: Promise<{ tournamentId: string }>;
}

// Revalidate page every 3 minutes for live tournament updates
export const revalidate = 180;

export default async function WeeklyStandingsByTournamentPage({
  params,
}: WeeklyStandingsPageProps) {
  const { tournamentId } = await params;
  const supabase = await createClient();
  const pageGeneratedAt = new Date().getTime();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get user's league
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('league_id')
    .eq('id', user.id)
    .single();

  const userLeagueId = userProfile?.league_id;

  // Get tournament
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

  // Get all rosters for this tournament, ranked by total_winnings
  // Filter by user's league to show only rosters from the same league
  const { data: rosters, error: rostersError } = await supabase
    .from('user_rosters')
    .select(
      `
      id,
      roster_name,
      total_winnings,
      user_id,
      profiles!inner(username, league_id),
      tournament:tournaments(name, status)
    `
    )
    .eq('tournament_id', tournamentId)
    .eq('profiles.league_id', userLeagueId)
    .order('total_winnings', { ascending: false });

  if (rostersError) {
    console.error('Error loading rosters:', rostersError);
  }

  // Get user's roster rank
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRosterIndex = rosters?.findIndex((r: any) => r.user_id === user.id);
  const userRank = userRosterIndex !== undefined && userRosterIndex !== -1 ? userRosterIndex + 1 : null;

  // Get all tournaments for selector, prioritizing active tournaments
  // Sort: active first, then by start_date
  const { data: allTournaments } = await supabase
    .from('tournaments')
    .select('id, name, status, start_date')
    .order('status', { ascending: true }) // This will sort: active, completed, upcoming (alphabetically)
    .order('start_date', { ascending: false });

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

  // Determine current week's tournament
  // 1. If there's an active tournament, show that
  // 2. After Monday noon CST, show the next upcoming tournament
  // 3. Otherwise, show the most recent completed tournament
  
  const { data: currentActive } = await supabase
    .from('tournaments')
    .select('id')
    .eq('status', 'active')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

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

      {/* Standings Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg sm:text-xl">Team Standings</CardTitle>
              <p className="text-xs sm:text-sm text-casino-gray mt-1">
                Last updated: {formatTimestampCST(pageGeneratedAt)}
              </p>
            </div>
            {tournament.status === 'upcoming' && (
              <div className="text-xs text-casino-gray bg-casino-card border border-casino-gold/20 px-3 py-1 rounded-md whitespace-nowrap self-start">
                🔒 Rosters locked until tournament starts
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {rosters && rosters.length > 0 ? (
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
                      const isUserRoster = roster.user_id === user.id;

                      return (
                        <ExpandableRosterRow
                          key={roster.id}
                          roster={roster}
                          index={index}
                          isUserRoster={isUserRoster}
                          tournamentId={tournamentId}
                          tournamentStatus={tournament.status}
                          currentUserId={user.id}
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

      {/* User's Rank Summary */}
      {userRank && (
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
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {formatCurrency(
                    rosters?.find((r: any) => r.user_id === user.id)?.total_winnings || 0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
