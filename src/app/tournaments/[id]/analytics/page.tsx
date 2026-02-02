import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth/profile';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { InsideTheFieldTable } from '@/components/tournaments/InsideTheFieldTable';
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
  pickedByUsers: string[]; // Names of users who picked this player
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

  // Inside the Field is only shown when the tournament is active or completed (not upcoming)
  if (tournament.status === 'upcoming') {
    return (
      <div className="min-h-screen bg-casino-dark p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href={`/tournaments/${id}`}
            className="text-casino-gold hover:text-casino-gold/80 mb-4 inline-block"
          >
            ← Back to Tournament
          </Link>
          <Card className="bg-casino-card border-casino-gold/20">
            <CardContent className="py-12 text-center">
              <p className="text-casino-text font-medium mb-2">
                Inside the Field is available once the tournament has started.
              </p>
              <p className="text-casino-gray text-sm">
                {tournament.name} is upcoming. Check back when the tournament is in progress or completed.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
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
    // Build a map from roster_id to username
    const rosterToUserMap = new Map<string, string>();
    for (const roster of leagueRosters || []) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', roster.user_id)
        .single();
      if (userProfile?.username) {
        rosterToUserMap.set(roster.id, userProfile.username);
      }
    }

    const { data: selectionData, error: selectionError } = await supabase
      .from('roster_players')
      .select(`
        roster_id,
        tournament_player:tournament_players!inner(
          pga_players!inner(name)
        )
      `)
      .in('roster_id', rosterIds);

    if (selectionError) {
      console.error('Error fetching selections:', selectionError);
    }

    if (selectionData) {
      // Count selections per player and track who picked them
      const playerCounts = new Map<string, number>();
      const playerPickedBy = new Map<string, string[]>();
      
      selectionData.forEach((row) => {
        const tp = row.tournament_player as unknown as { pga_players: { name: string } };
        const playerName = tp?.pga_players?.name;
        if (playerName) {
          playerCounts.set(playerName, (playerCounts.get(playerName) || 0) + 1);
          
          // Track which user picked this player
          const username = rosterToUserMap.get(row.roster_id);
          if (username) {
            const currentPickers = playerPickedBy.get(playerName) || [];
            if (!currentPickers.includes(username)) {
              currentPickers.push(username);
              playerPickedBy.set(playerName, currentPickers);
            }
          }
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
            pickedByUsers: playerPickedBy.get(playerName) || [],
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
              <InsideTheFieldTable playerStats={playerStats} totalRosters={totalRosters} />
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
