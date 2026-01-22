import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { formatCurrency } from '@/lib/prize-money';

export default async function AdminRostersPage() {
  const supabase = await createClient();

  // Get all rosters with player details
  const { data: rosters, error } = await supabase
    .from('user_rosters')
    .select(`
      id,
      roster_name,
      total_winnings,
      budget_spent,
      user_id,
      profiles(username),
      tournaments(name, status),
      roster_players(
        player_winnings,
        tournament_player:tournament_players(
          position,
          prize_money,
          pga_players(name)
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading rosters:', error);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Back to Admin
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          View All Rosters
        </h1>
        <p className="text-gray-600">
          Debug and verify roster data, player assignments, and winnings calculations.
        </p>
      </div>

      {rosters && rosters.length > 0 ? (
        <div className="space-y-4">
          {rosters.map((roster: any) => (
            <Card key={roster.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{roster.roster_name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Owner: {roster.profiles?.username || 'Unknown'} | 
                      Tournament: {roster.tournaments?.name || 'Unknown'} ({roster.tournaments?.status})
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(roster.total_winnings || 0)}
                    </p>
                    <p className="text-xs text-gray-500">Total Winnings</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Budget: ${(roster.budget_spent || 0).toFixed(2)} / $30.00
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">
                  Players ({roster.roster_players?.length || 0}):
                </h4>
                {roster.roster_players && roster.roster_players.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Player
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                            Position
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Prize Money
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {roster.roster_players.map((rp: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {rp.tournament_player?.pga_players?.name || 'Unknown'}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-center">
                              {rp.tournament_player?.position ? (
                                <span className="font-medium">
                                  {rp.tournament_player.position > 1 ? 'T' : ''}
                                  {rp.tournament_player.position}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm text-right">
                              <span
                                className={
                                  (rp.player_winnings || 0) > 0
                                    ? 'text-green-600 font-semibold'
                                    : 'text-gray-400'
                                }
                              >
                                {formatCurrency(rp.player_winnings || 0)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td
                            colSpan={2}
                            className="px-3 py-2 text-sm font-semibold text-gray-900 text-right"
                          >
                            Total:
                          </td>
                          <td className="px-3 py-2 text-sm font-bold text-green-600 text-right">
                            {formatCurrency(
                              roster.roster_players.reduce(
                                (sum: number, rp: any) =>
                                  sum + (rp.player_winnings || 0),
                                0
                              )
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No players in this roster</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">No rosters found.</p>
            <Link href="/tournaments" className="mt-4 inline-block">
              <Button>Create Your First Roster</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
