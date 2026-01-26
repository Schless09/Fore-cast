import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth/profile';
import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/logger';
import { LiveSeasonStandings } from '@/components/standings/LiveSeasonStandings';

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
  // Auth is handled by middleware
  const profile = await getProfile();
  if (!profile) {
    redirect('/auth');
  }
  
  const supabase = createServiceClient();

  const userLeagueId = profile.active_league_id;

  // Get all tournaments (completed and active)
  const { data: tournaments, error: tournamentsError } = await supabase
    .from('tournaments')
    .select('id, name, status, rapidapi_tourn_id')
    .in('status', ['completed', 'active']);

  if (tournamentsError) {
    logger.error('Error loading tournaments for season standings', {
      errorMessage: tournamentsError.message,
      errorCode: tournamentsError.code,
    }, tournamentsError as Error);
  }

  const tournamentIds = tournaments?.map(t => t.id) || [];
  
  // Find active tournament
  const activeTournamentData = tournaments?.find(t => t.status === 'active');
  
  // Get prize distributions for active tournament
  let prizeDistributions: Array<{ position: number; amount: number }> = [];
  if (activeTournamentData) {
    const { data: prizeData } = await supabase
      .from('prize_money_distributions')
      .select('position, amount')
      .eq('tournament_id', activeTournamentData.id)
      .order('position', { ascending: true });
    
    prizeDistributions = (prizeData || []).map(p => ({
      position: p.position,
      amount: p.amount || 0,
    }));
  }

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

  // Aggregate winnings by user (only completed tournaments for base winnings)
  interface CompletedStanding {
    user_id: string;
    username: string;
    completed_winnings: number;
    tournaments_played: number;
    rosters: Array<{
      roster_name: string;
      tournament_name: string;
      winnings: number;
      is_active: boolean;
    }>;
  }
  
  const standingsMap = new Map<string, CompletedStanding>();

  // Sort rosters by tournament start_date manually since we can't order by nested field
  const sortedRosters = [...rosters].sort((a: RosterData, b: RosterData) => {
    const aDate = a.tournament?.start_date || '';
    const bDate = b.tournament?.start_date || '';
    return bDate.localeCompare(aDate); // Most recent first
  });

  sortedRosters.forEach((roster: RosterData) => {
    const userId = roster.user_id;
    const username = roster.profiles?.username || 'Unknown';
    const tournamentName = roster.tournament?.name || 'Unknown Tournament';
    const isActive = roster.tournament?.status === 'active';
    
    // Only count completed tournament winnings in base (live will be added client-side)
    const winnings = isActive ? 0 : (roster.total_winnings || 0);

    if (!standingsMap.has(userId)) {
      standingsMap.set(userId, {
        user_id: userId,
        username,
        completed_winnings: 0,
        tournaments_played: 0,
        rosters: [],
      });
    }

    const standing = standingsMap.get(userId)!;
    standing.completed_winnings += winnings;
    standing.tournaments_played += 1;
    standing.rosters.push({
      roster_name: roster.roster_name,
      tournament_name: tournamentName,
      winnings: isActive ? 0 : (roster.total_winnings || 0), // Will be updated live for active
      is_active: isActive,
    });
  });

  // Convert to array and sort by completed winnings (live will re-sort client-side)
  const completedStandings = Array.from(standingsMap.values()).sort(
    (a, b) => b.completed_winnings - a.completed_winnings
  );

  // Prepare active tournament info
  const activeTournament = activeTournamentData && activeTournamentData.rapidapi_tourn_id ? {
    id: activeTournamentData.id,
    name: activeTournamentData.name,
    liveGolfAPITournamentId: activeTournamentData.rapidapi_tourn_id,
  } : undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-linear-to-r from-casino-gold to-casino-gold-light bg-clip-text text-transparent mb-2">Season Standings</h1>
        <p className="text-casino-gray">
          Cumulative winnings across all tournaments this season
        </p>
      </div>

      <LiveSeasonStandings
        completedStandings={completedStandings}
        currentUserId={profile.id}
        activeTournament={activeTournament}
        prizeDistributions={prizeDistributions}
        userLeagueId={userLeagueId || undefined}
      />
    </div>
  );
}
