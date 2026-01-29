import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth/profile';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/prize-money';
import Link from 'next/link';

interface AnalyticsPageProps {
  params: Promise<{ id: string }>;
}

interface PlayerSelectionStats {
  playerName: string;
  selectionCount: number;
  percentage: number;
  position: string | null;
  prizeMoney: number;
  isOnUserRoster: boolean;
  cost: number;
}

interface CachedPlayer {
  player?: string;
  firstName?: string;
  lastName?: string;
  positionValue?: number;
  position?: string;
  earnings?: number;
}

interface PrizeDistributionRow {
  position: number;
  amount: number;
}

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { id } = await params;
  
  const profile = await getProfile();
  if (!profile) {
    redirect('/auth/login');
  }

  const supabase = createServiceClient();

  // Get tournament info
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, status')
    .eq('id', id)
    .single();

  if (!tournament) {
    redirect('/tournaments');
  }

  // Get total roster count for this tournament in user's league
  const { data: leagueRosters, error: rostersError } = await supabase
    .from('user_rosters')
    .select(`
      id,
      user_id,
      profiles!inner(active_league_id)
    `)
    .eq('tournament_id', id)
    .eq('profiles.active_league_id', profile.active_league_id);

  if (rostersError) {
    console.error('Error fetching rosters:', rostersError);
  }

  const totalRosters = leagueRosters?.length || 0;
  const rosterIds = leagueRosters?.map(r => r.id) || [];

  // Get the current user's roster for this tournament
  const userRoster = leagueRosters?.find(r => r.user_id === profile.id);
  const userRosterPlayerNames = new Set<string>();
  
  if (userRoster) {
    const { data: userRosterPlayers } = await supabase
      .from('roster_players')
      .select(`
        tournament_player:tournament_players!inner(
          pga_players!inner(name)
        )
      `)
      .eq('roster_id', userRoster.id);
    
    userRosterPlayers?.forEach((rp) => {
      const tp = rp.tournament_player as unknown as { pga_players: { name: string } };
      if (tp?.pga_players?.name) {
        userRosterPlayerNames.add(tp.pga_players.name);
      }
    });
  }

  // Get prize distributions for calculating earnings
  const { data: prizeDistributions } = await supabase
    .from('prize_money_distributions')
    .select('position, amount')
    .eq('tournament_id', id)
    .order('position', { ascending: true });

  const prizeDistributionMap = new Map<number, PrizeDistributionRow>(
    (prizeDistributions || []).map((p) => [p.position, p])
  );

  // Helper to calculate prize money with tie handling
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

  // Get live earnings from cache (this is where live positions/earnings are stored)
  const { data: cachedData } = await supabase
    .from('live_scores_cache')
    .select('data')
    .eq('tournament_id', id)
    .single();

  // Build a map of player name to their live earnings and position
  const playerLiveDataMap = new Map<string, { prizeMoney: number; position: string | null }>();
  
  if (cachedData?.data?.data && Array.isArray(cachedData.data.data)) {
    const leaderboard = cachedData.data.data as CachedPlayer[];
    
    // Count positions for tie handling
    const positionCounts = new Map<number, number>();
    leaderboard.forEach((player) => {
      const posNum = player.positionValue || parseInt(String(player.position)?.replace('T', '') || '') || null;
      if (posNum && posNum > 0) {
        positionCounts.set(posNum, (positionCounts.get(posNum) || 0) + 1);
      }
    });

    leaderboard.forEach((player) => {
      const name = player.player || (player.firstName && player.lastName ? `${player.firstName} ${player.lastName}` : null);
      if (!name) return;

      const posNum = player.positionValue || parseInt(String(player.position)?.replace('T', '') || '') || null;
      const tieCount = posNum ? (positionCounts.get(posNum) || 1) : 1;
      const prizeMoney = player.earnings || calculateTiePrizeMoney(posNum, tieCount);
      const posDisplay = posNum ? (tieCount > 1 ? `T${posNum}` : String(posNum)) : null;

      playerLiveDataMap.set(name, { prizeMoney, position: posDisplay });
    });
  }

  // Get player costs from tournament_players
  const { data: tournamentPlayers } = await supabase
    .from('tournament_players')
    .select(`
      cost,
      pga_players!inner(name)
    `)
    .eq('tournament_id', id);

  const playerCostMap = new Map<string, number>();
  tournamentPlayers?.forEach((tp) => {
    const pga = tp.pga_players as unknown as { name: string };
    if (pga?.name) {
      playerCostMap.set(pga.name, tp.cost || 0);
    }
  });

  // Get player selection counts
  let playerStats: PlayerSelectionStats[] = [];

  if (rosterIds.length > 0) {
    const { data: selectionData, error: selectionError } = await supabase
      .from('roster_players')
      .select(`
        tournament_player:tournament_players!inner(
          pga_players!inner(name)
        )
      `)
      .in('roster_id', rosterIds);

    if (selectionError) {
      console.error('Error fetching selections:', selectionError);
    }

    if (selectionData) {
      // Count selections per player
      const playerCounts = new Map<string, number>();
      
      selectionData.forEach((row) => {
        const tp = row.tournament_player as unknown as { pga_players: { name: string } };
        const playerName = tp?.pga_players?.name;
        if (playerName) {
          playerCounts.set(playerName, (playerCounts.get(playerName) || 0) + 1);
        }
      });

      // Convert to array and sort by selection count
      playerStats = Array.from(playerCounts.entries())
        .map(([playerName, selectionCount]) => {
          const liveData = playerLiveDataMap.get(playerName) || { prizeMoney: 0, position: null };
          return {
            playerName,
            selectionCount,
            percentage: totalRosters > 0 ? Math.round((selectionCount / totalRosters) * 100) : 0,
            position: liveData.position,
            prizeMoney: liveData.prizeMoney,
            isOnUserRoster: userRosterPlayerNames.has(playerName),
            cost: playerCostMap.get(playerName) || 0,
          };
        })
        .sort((a, b) => b.selectionCount - a.selectionCount);
    }
  }

  return (
    <div className="min-h-screen bg-casino-dark p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <Link 
          href={`/tournaments/${id}`}
          className="text-casino-gold hover:text-casino-gold/80 mb-4 inline-block"
        >
          ← Back to Tournament
        </Link>

        <Card className="bg-casino-card border-casino-gold/20">
          <CardHeader>
            <CardTitle className="text-casino-gold">
              Inside the Field
            </CardTitle>
            <p className="text-casino-gray text-sm">
              {tournament.name} • {totalRosters} team{totalRosters !== 1 ? 's' : ''} in your league
            </p>
            {userRosterPlayerNames.size > 0 && (
              <p className="text-xs text-casino-green mt-1">
                ⭐ Your players are highlighted
              </p>
            )}
          </CardHeader>
          <CardContent>
            {playerStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
                      <th className="px-1 sm:px-3 py-3 w-8">#</th>
                      <th className="px-1 sm:px-3 py-3">Player</th>
                      <th className="px-1 sm:px-3 py-3 text-center hidden sm:table-cell">Picked</th>
                      <th className="px-1 sm:px-3 py-3 text-center">Pos</th>
                      <th className="px-1 sm:px-3 py-3 text-right">Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerStats.map((player, index) => (
                      <tr 
                        key={player.playerName}
                        className={`border-b transition-colors ${
                          player.isOnUserRoster
                            ? 'bg-casino-gold/20 border-casino-gold/40 hover:bg-casino-gold/30'
                            : 'border-casino-gold/10 hover:bg-casino-elevated'
                        }`}
                      >
                        <td className="px-1 sm:px-3 py-3 text-casino-gray">
                          {player.isOnUserRoster && <span className="mr-1"></span>}
                          {index + 1}
                        </td>
                        <td className={`px-1 sm:px-3 py-3 font-medium ${player.isOnUserRoster ? 'text-casino-gold' : 'text-casino-text'}`}>
                          <div className="flex flex-col">
                            <span>
                              {player.playerName}
                              <span className="text-casino-gray font-normal ml-1">(${player.cost})</span>
                            </span>
                            <span className="text-xs text-casino-gray sm:hidden">
                              {player.selectionCount}/{totalRosters} teams ({player.percentage}%)
                            </span>
                          </div>
                        </td>
                        <td className="px-1 sm:px-3 py-3 text-center hidden sm:table-cell">
                          <span className={`font-semibold ${
                            player.selectionCount >= totalRosters * 0.75 ? 'text-casino-gold' :
                            player.selectionCount >= totalRosters * 0.5 ? 'text-casino-green' :
                            'text-casino-text'
                          }`}>
                            {player.selectionCount}
                          </span>
                          <span className="text-casino-gray text-xs ml-1">
                            ({player.percentage}%)
                          </span>
                        </td>
                        <td className="px-1 sm:px-3 py-3 text-center">
                          {player.position ? (
                            <span className={`font-medium ${
                              parseInt(player.position.replace('T', '')) === 1 ? 'text-casino-gold' :
                              parseInt(player.position.replace('T', '')) <= 10 ? 'text-casino-green' :
                              'text-casino-text'
                            }`}>
                              {player.position}
                            </span>
                          ) : (
                            <span className="text-casino-gray-dark">-</span>
                          )}
                        </td>
                        <td className="px-1 sm:px-3 py-3 text-right">
                          <span className={player.prizeMoney > 0 ? 'text-casino-green' : 'text-casino-gray-dark'}>
                            {formatCurrency(player.prizeMoney)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-casino-gray">
                No player selections found for this tournament in your league.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="mt-4 p-4 bg-casino-card rounded-lg border border-casino-gold/20">
          <p className="text-casino-gray text-xs">
            <span className="text-casino-gold">●</span> 75%+ of teams • 
            <span className="text-casino-green ml-2">●</span> 50-74% of teams • 
            <span className="text-casino-blue ml-2">●</span> 25-49% of teams • 
            <span className="text-casino-gray ml-2">●</span> &lt;25% of teams
          </p>
        </div>
      </div>
    </div>
  );
}
