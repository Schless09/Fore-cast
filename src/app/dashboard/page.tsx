import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { RosterWithDetails } from '@/lib/types';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get user's rosters with details
  const { data: rosters, error } = await supabase
    .from('user_rosters')
    .select(
      `
      *,
      tournament:tournaments(*),
      roster_players(
        fantasy_points
      )
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Calculate total winnings across all rosters
  const totalWinnings =
    rosters?.reduce((sum, roster) => {
      return sum + (roster.total_winnings || 0);
    }, 0) || 0;

  const activeRosters =
    rosters?.filter(
      (r: RosterWithDetails) =>
        r.tournament?.status === 'active' || r.tournament?.status === 'upcoming'
    ) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Your Dashboard
        </h1>
        <p className="text-gray-300">Manage your fantasy golf rosters</p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Total Rosters</div>
            <div className="text-3xl font-bold text-gray-900">
              {rosters?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Active Rosters</div>
            <div className="text-3xl font-bold text-green-600">
              {activeRosters.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">
              Total Winnings
            </div>
            <div className="text-3xl font-bold text-green-600">
              ${totalWinnings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links to Standings */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Link href="/standings/weekly">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-2 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Weekly Standings</div>
                  <div className="text-lg font-semibold text-gray-900">
                    Current Week's Tournament
                  </div>
                  <div className="text-xs text-green-600 mt-1">⭐ Active or most recent</div>
                </div>
                <span className="text-2xl">📊</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/standings/season">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Season Standings</div>
                  <div className="text-lg font-semibold text-gray-900">
                    Cumulative Season Leaderboard
                  </div>
                </div>
                <span className="text-2xl">🏆</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Active Rosters */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-white mb-4">
          Active Rosters
        </h2>
        {activeRosters.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-6">
            {activeRosters.map((roster: RosterWithDetails) => {
              const rosterWinnings = roster.total_winnings || 0;

              return (
                <Card key={roster.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{roster.roster_name}</CardTitle>
                        {roster.tournament && (
                          <p className="text-sm text-gray-600 mt-1">
                            {roster.tournament.name}
                          </p>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        roster.tournament?.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {roster.tournament?.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Total Winnings</p>
                        <p className="text-2xl font-bold text-green-600">
                          ${rosterWinnings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      {roster.tournament && (
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Tournament</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(roster.tournament.start_date)}
                          </p>
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/tournaments/${roster.tournament_id}/roster/${roster.id}`}
                    >
                      <Button variant="outline" className="w-full">
                        View Leaderboard
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600 mb-4">
                You don't have any active rosters yet.
              </p>
              <Link href="/tournaments">
                <Button>Browse Tournaments</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* All Rosters */}
      {rosters && rosters.length > activeRosters.length && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            All Rosters
          </h2>
          <div className="space-y-4">
            {rosters
              .filter(
                (r: RosterWithDetails) =>
                  r.tournament?.status !== 'active' &&
                  r.tournament?.status !== 'upcoming'
              )
              .map((roster: RosterWithDetails) => {
                const rosterWinnings = roster.total_winnings || 0;

                return (
                  <Card
                    key={roster.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {roster.roster_name}
                          </h3>
                          {roster.tournament && (
                            <p className="text-sm text-gray-600">
                              {roster.tournament.name} •{' '}
                              {formatDate(roster.tournament.start_date)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-gray-600">
                              Total Winnings
                            </p>
                            <p className="text-xl font-bold text-green-600">
                              ${rosterWinnings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          {roster.tournament && (
                            <Link
                              href={`/tournaments/${roster.tournament_id}/roster/${roster.id}`}
                            >
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
