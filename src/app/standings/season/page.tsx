import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth/profile';
import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/logger';
import { LiveSeasonStandings } from '@/components/standings/LiveSeasonStandings';

export const metadata: Metadata = {
  title: 'Season Fantasy Golf Standings',
  description: 'Full season fantasy golf standings and leaderboard. Year-long fantasy golf league results.',
};

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

interface LeagueTournamentSetting {
  tournament_id: string;
  segments: number[];
  is_excluded: boolean;
}

interface SegmentDefinition {
  number: number;
  name: string;
}

// Revalidate page every 3 minutes
export const revalidate = 180;

interface SeasonStandingsPageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function SeasonStandingsPage({ searchParams }: SeasonStandingsPageProps) {
  const resolvedParams = await searchParams;
  // Convert period string to SeasonPeriod type ('full' or segment number)
  const periodParam = resolvedParams.period;
  const initialPeriod: 'full' | number | undefined = 
    periodParam === 'full' ? 'full' :
    periodParam === 'first' ? 1 :
    periodParam === 'second' ? 2 :
    periodParam ? parseInt(periodParam, 10) || undefined :
    undefined;
  // Auth is handled by middleware
  const profile = await getProfile();
  if (!profile) {
    redirect('/auth');
  }
  
  const supabase = createServiceClient();

  const userLeagueId = profile.active_league_id;

  // League members for roster filter (so multi-league users show in this league's season standings)
  let leagueMemberIds: string[] = [];
  if (userLeagueId) {
    const { data: leagueMembers } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', userLeagueId);
    leagueMemberIds = (leagueMembers || []).map((m) => m.user_id);
  }

  // Get all tournaments (completed and active)
  const { data: tournaments, error: tournamentsError } = await supabase
    .from('tournaments')
    .select('id, name, status, rapidapi_tourn_id, espn_event_id, start_date')
    .in('status', ['completed', 'active']);

  if (tournamentsError) {
    logger.error('Error loading tournaments for season standings', {
      errorMessage: tournamentsError.message,
      errorCode: tournamentsError.code,
    }, tournamentsError as Error);
  }

  // Get league tournament settings (if league has custom configuration)
  let leagueTournamentSettings: LeagueTournamentSetting[] = [];
  let segmentDefinitions: SegmentDefinition[] = [];
  
  if (userLeagueId) {
    // Get tournament settings with segments array
    const { data: ltData } = await supabase
      .from('league_tournaments')
      .select('tournament_id, segments, is_excluded')
      .eq('league_id', userLeagueId);
    
    leagueTournamentSettings = (ltData || []).map(lt => ({
      tournament_id: lt.tournament_id,
      segments: lt.segments || [],
      is_excluded: lt.is_excluded,
    }));
    
    // Get custom segment names
    const { data: segData } = await supabase
      .from('league_segments')
      .select('segment_number, name')
      .eq('league_id', userLeagueId)
      .order('segment_number', { ascending: true });
    
    segmentDefinitions = (segData || []).map(s => ({
      number: s.segment_number,
      name: s.name,
    }));
  }

  // Create a map for quick lookup of tournament settings
  const tournamentSettingsMap = new Map<string, LeagueTournamentSetting>(
    leagueTournamentSettings.map(lt => [lt.tournament_id, lt])
  );

  // Filter out excluded tournaments
  const filteredTournaments = (tournaments || []).filter(t => {
    const setting = tournamentSettingsMap.get(t.id);
    // If no setting exists, tournament is included by default
    return !setting?.is_excluded;
  });

  const tournamentIds = filteredTournaments.map(t => t.id);
  
  // Find active tournament
  const activeTournamentData = tournaments?.find(t => t.status === 'active');
  
  // Get prize distributions and live cache (cutLine, current_round) for active tournament
  let prizeDistributions: Array<{ position: number; amount: number }> = [];
  let cutLineForSeason: { cutScore: string; cutCount: number } | null = null;
  let displayRoundForSeason = 1;
  if (activeTournamentData) {
    const [prizeResult, espnCacheResult, liveScoresCacheResult] = await Promise.all([
      supabase
        .from('prize_money_distributions')
        .select('position, amount')
        .eq('tournament_id', activeTournamentData.id)
        .order('position', { ascending: true }),
      activeTournamentData.espn_event_id
        ? supabase.from('espn_cache').select('current_round, data').eq('cache_key', `espn-${activeTournamentData.espn_event_id}`).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      activeTournamentData.rapidapi_tourn_id && (activeTournamentData as { start_date?: string }).start_date
        ? supabase.from('live_scores_cache').select('current_round, data').eq('cache_key', `${new Date((activeTournamentData as { start_date: string }).start_date).getFullYear()}-${activeTournamentData.rapidapi_tourn_id}`).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    const prizeData = prizeResult.data;
    prizeDistributions = (prizeData || []).map(p => ({
      position: p.position,
      amount: p.amount || 0,
    }));
    const cacheDataWithCut = (espnCacheResult.data?.data as { cutLine?: { cutScore: string; cutCount: number } } | undefined)
      ?? (liveScoresCacheResult.data?.data as { cutLine?: { cutScore: string; cutCount: number } } | undefined);
    cutLineForSeason = cacheDataWithCut?.cutLine ?? null;
    const rawRound = espnCacheResult.data?.current_round ?? liveScoresCacheResult.data?.current_round;
    displayRoundForSeason = typeof rawRound === 'number' ? rawRound : (rawRound && typeof rawRound === 'object' && '$numberInt' in rawRound ? parseInt((rawRound as { $numberInt: string }).$numberInt, 10) : 1);
  }

  // Only query rosters if we have tournaments
  let rosters: RosterData[] = [];
  let rostersError: SupabaseError | null = null;

  if (tournamentIds.length > 0) {
    const baseQuery = supabase
      .from('user_rosters')
      .select(
        `
        id,
        user_id,
        roster_name,
        total_winnings,
        profiles(username),
        tournament:tournaments(id, name, status, start_date)
      `
      )
      .in('tournament_id', tournamentIds)
      .order('created_at', { ascending: false });

    const result = leagueMemberIds.length > 0
      ? await baseQuery.in('user_id', leagueMemberIds)
      : await baseQuery;

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
      tournament_id: string;
      winnings: number;
      is_active: boolean;
      segments: number[]; // Changed from segment: number | null
    }>;
  }
  
  const standingsMap = new Map<string, CompletedStanding>();

  // Sort rosters by tournament start_date manually since we can't order by nested field
  const sortedRosters = [...rosters].sort((a: RosterData, b: RosterData) => {
    const aDate = a.tournament?.start_date || '';
    const bDate = b.tournament?.start_date || '';
    return bDate.localeCompare(aDate); // Most recent first
  });

  // Helper to get tournament segments from league settings
  const getTournamentSegments = (tournamentId: string): number[] => {
    const setting = tournamentSettingsMap.get(tournamentId);
    return setting?.segments ?? [];
  };

  sortedRosters.forEach((roster: RosterData) => {
    const userId = roster.user_id;
    const username = roster.profiles?.username || 'Unknown';
    const tournamentName = roster.tournament?.name || 'Unknown Tournament';
    const tournamentId = roster.tournament?.id || '';
    const isActive = roster.tournament?.status === 'active';
    
    // Get segments from league settings (empty array means included in all segments)
    const segments = getTournamentSegments(tournamentId);
    
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
      tournament_id: tournamentId,
      winnings: isActive ? 0 : (roster.total_winnings || 0), // Will be updated live for active
      is_active: isActive,
      segments: segments,
    });
  });

  // Convert to array and sort by completed winnings (live will re-sort client-side)
  const completedStandings = Array.from(standingsMap.values()).sort(
    (a, b) => b.completed_winnings - a.completed_winnings
  );

  // Prepare active tournament info (include cutLine and displayRound for live prize cut logic)
  const activeTournament = activeTournamentData && (activeTournamentData.rapidapi_tourn_id || activeTournamentData.espn_event_id) ? {
    id: activeTournamentData.id,
    name: activeTournamentData.name,
    liveGolfAPITournamentId: activeTournamentData.rapidapi_tourn_id,
    espnEventId: activeTournamentData.espn_event_id,
    scorecardSource: activeTournamentData.espn_event_id ? 'espn' as const : 'rapidapi' as const,
    cutLine: cutLineForSeason,
    displayRound: displayRoundForSeason,
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
        leagueMemberIds={leagueMemberIds.length > 0 ? leagueMemberIds : undefined}
        initialPeriod={initialPeriod}
        segmentDefinitions={segmentDefinitions}
      />
    </div>
  );
}
