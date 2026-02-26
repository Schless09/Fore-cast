'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/prize-money';
import { REFRESH_INTERVAL_MS } from '@/lib/config';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  processLiveScoresForPrizes,
  normalizeNameForLookup,
  firstNamesMatchForLiveScores,
} from '@/lib/live-scores-prizes';

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
    segments: number[]; // empty array means included in all segments
    /** Golfer finish positions in this tournament (1st, 2nd, 23rd, etc.) for W/T5/T10/T25 counts */
    player_positions?: number[];
  }>;
}

interface SegmentDefinition {
  number: number;
  name: string;
}

type SeasonPeriod = 'full' | number; // 'full' or segment number (1, 2, 3...)

interface LiveScore {
  player: string;
  playerId: string;
  position: string;
  positionValue: number | null;
  total: string;
  thru: string;
  currentRoundScore: string;
  isAmateur?: boolean;
}

interface RosterPlayer {
  tournament_player?: {
    pga_players?: {
      name: string;
    } | null;
  } | null;
}

interface ActiveRosterData {
  id: string;
  user_id: string;
  roster_name: string;
  roster_players: RosterPlayer[] | null;
}

interface LiveSeasonStandingsProps {
  completedStandings: CompletedStanding[];
  currentUserId: string;
  activeTournament?: {
    id: string;
    name: string;
    liveGolfAPITournamentId: string;
    espnEventId?: string | null;
    scorecardSource?: 'espn' | 'rapidapi';
    cutLine?: { cutScore: string; cutCount: number } | null;
    displayRound?: number;
  };
  prizeDistributions: Array<{
    position: number;
    amount: number;
  }>;
  userLeagueId?: string;
  /** When provided, filter rosters by league membership (not active_league_id) so multi-league users show in season standings */
  leagueMemberIds?: string[];
  initialPeriod?: SeasonPeriod;
  segmentDefinitions?: SegmentDefinition[];
}

export function LiveSeasonStandings({
  completedStandings,
  currentUserId,
  activeTournament,
  prizeDistributions,
  userLeagueId,
  leagueMemberIds,
  initialPeriod,
  segmentDefinitions = [],
}: LiveSeasonStandingsProps) {
  const [liveScores, setLiveScores] = useState<LiveScore[]>([]);
  const [liveSource, setLiveSource] = useState<'espn' | 'rapidapi'>(
    activeTournament?.scorecardSource ?? 'rapidapi'
  );
  const [activeRosters, setActiveRosters] = useState<Map<string, { rosterId: string; rosterName: string; playerNames: string[] }>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextRefreshIn, setNextRefreshIn] = useState(REFRESH_INTERVAL_MS / 1000);
  const [selectedPeriod, setSelectedPeriod] = useState<SeasonPeriod>(initialPeriod || 'full');
  const hasInitialLoaded = useRef(false);
  // Use round/cut from live API when present so season matches weekly (same source of truth)
  const [liveRound, setLiveRound] = useState<number | null>(null);
  const [liveCutLine, setLiveCutLine] = useState<{ cutScore: string; cutCount: number } | null>(null);
  const [selectedMember, setSelectedMember] = useState<{ user_id: string; username: string } | null>(null);

  // Prize distribution map
  const prizeMap = useMemo(
    () => new Map(prizeDistributions.map((d) => [d.position, d.amount])),
    [prizeDistributions]
  );

  // Create a map of player name -> live score data with multiple lookup keys (use shared normalize so API "Højgaard" matches DB "Hojgaard")
  const playerScoreMap = useMemo(() => {
    const map = new Map<string, LiveScore>();
    liveScores.forEach((score) => {
      const normalizedName = normalizeNameForLookup(score.player);
      map.set(normalizedName, score);
      
      // Also add lookup by last name for fuzzy matching
      const nameParts = normalizedName.split(' ');
      if (nameParts.length >= 2) {
        const lastName = nameParts[nameParts.length - 1];
        const firstName = nameParts[0];
        map.set(`__fuzzy__${lastName}__${firstName}`, score);
      }
    });
    return map;
  }, [liveScores]);

  // Find live score with fuzzy matching for nicknames
  const findLiveScore = useCallback((playerName: string): LiveScore | undefined => {
    const normalizedName = normalizeNameForLookup(playerName);
    
    // Try exact match first
    const match = playerScoreMap.get(normalizedName);
    if (match) return match;
    
    // Try fuzzy matching by last name + first name starts with
    const nameParts = normalizedName.split(' ');
    if (nameParts.length >= 2) {
      const lastName = nameParts[nameParts.length - 1];
      const firstName = nameParts[0];
      
      for (const [key, score] of playerScoreMap.entries()) {
        if (key.startsWith('__fuzzy__')) {
          const [, fuzzyLastName, fuzzyFirstName] = key.split('__').filter(Boolean);
          if (fuzzyLastName === lastName && firstNamesMatchForLiveScores(firstName, fuzzyFirstName)) {
            return score;
          }
        }
      }
    }
    
    return undefined;
  }, [playerScoreMap]);

  // Shared prize logic: position-from-score (ESPN), tie split; R1/R2 projected cut by score, R3/R4 cut by position
  const prizeDataByPlayer = useMemo(() => {
    if (!liveScores.length) return new Map<string, number>();
    const effectiveCutLine = liveCutLine ?? activeTournament?.cutLine ?? undefined;
    const effectiveRound = liveRound ?? activeTournament?.displayRound ?? 1;
    const processed = processLiveScoresForPrizes(liveScores, liveSource, prizeMap, {
      cutLine: effectiveCutLine,
      currentRound: effectiveRound,
    });
    const byPlayer = new Map<string, number>();
    processed.forEach((data, key) => {
      byPlayer.set(key, data.winnings);
    });
    return byPlayer;
  }, [liveScores, liveSource, prizeMap, activeTournament?.cutLine, activeTournament?.displayRound, liveCutLine, liveRound]);

  // Calculate live winnings for a roster (uses shared prize logic)
  const calculateLiveWinnings = useCallback((playerNames: string[]): number => {
    let total = 0;
    playerNames.forEach((name) => {
      const liveScore = findLiveScore(name);
      const lookupKey = liveScore ? normalizeNameForLookup(liveScore.player) : null;
      total += lookupKey ? (prizeDataByPlayer.get(lookupKey) ?? 0) : 0;
    });
    return total;
  }, [findLiveScore, prizeDataByPlayer]);

  // Combined standings with live data, filtered by selected period
  const combinedStandings = useMemo(() => {
    return completedStandings.map((standing) => {
      // Check if user has an active roster
      const activeRoster = activeRosters.get(standing.user_id);
      let liveWinnings = 0;
      
      if (activeRoster && activeTournament) {
        liveWinnings = calculateLiveWinnings(activeRoster.playerNames);
      }

      // Filter rosters based on selected period (segment)
      const filteredRosters = standing.rosters.filter((roster) => {
        if (selectedPeriod === 'full') return true;
        // If roster has no segments assigned (empty array), include it in all periods
        if (roster.segments.length === 0) return true;
        // Otherwise, check if the selected segment is in the roster's segments
        return roster.segments.includes(selectedPeriod as number);
      });

      // Calculate winnings for filtered rosters only
      const periodCompletedWinnings = filteredRosters
        .filter(r => !r.is_active)
        .reduce((sum, r) => sum + r.winnings, 0);

      // Check if active tournament should be included in this period
      // Find the active roster in filtered rosters to determine if it's in this period
      const activeRosterInPeriod = filteredRosters.some(r => r.is_active);
      const periodLiveWinnings = activeRosterInPeriod ? liveWinnings : 0;

      const totalWinnings = periodCompletedWinnings + periodLiveWinnings;

      // Update rosters with live winnings for active tournament
      const updatedRosters = filteredRosters.map((roster) => {
        if (roster.is_active && activeRoster) {
          return { ...roster, winnings: liveWinnings };
        }
        return roster;
      });

      return {
        ...standing,
        total_winnings: totalWinnings,
        live_winnings: periodLiveWinnings,
        tournaments_played: filteredRosters.length,
        rosters: updatedRosters,
      };
    })
    .filter(standing => standing.tournaments_played > 0) // Only show users who played in this period
    .sort((a, b) => b.total_winnings - a.total_winnings);
  }, [completedStandings, activeRosters, activeTournament, calculateLiveWinnings, selectedPeriod]);

  // Fetch active tournament rosters
  const fetchActiveRosters = useCallback(async () => {
    if (!activeTournament) return;

    const supabase = createClient();
    
    let query = supabase
      .from('user_rosters')
      .select(`
        id,
        user_id,
        roster_name,
        roster_players(
          tournament_player:tournament_players(
            pga_players(name)
          )
        )
      `)
      .eq('tournament_id', activeTournament.id);

    if (leagueMemberIds && leagueMemberIds.length > 0) {
      query = query.in('user_id', leagueMemberIds);
    } else if (userLeagueId) {
      query = query.eq('profiles.active_league_id', userLeagueId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching active rosters:', error);
      return;
    }

    const rostersMap = new Map<string, { rosterId: string; rosterName: string; playerNames: string[] }>();
    
    ((data || []) as ActiveRosterData[]).forEach((roster) => {
      const playerNames = (roster.roster_players || [])
        .map((rp: RosterPlayer) => rp.tournament_player?.pga_players?.name)
        .filter((name): name is string => Boolean(name));
      
      rostersMap.set(roster.user_id, {
        rosterId: roster.id,
        rosterName: roster.roster_name,
        playerNames,
      });
    });

    setActiveRosters(rostersMap);
  }, [activeTournament, userLeagueId, leagueMemberIds]);

  // Fetch live scores from API
  const fetchLiveScores = useCallback(async () => {
    const useEspn = activeTournament?.scorecardSource === 'espn' && activeTournament?.espnEventId;
    const url = useEspn
      ? `/api/scores/live?source=espn&eventId=${encodeURIComponent(activeTournament!.espnEventId!)}`
      : activeTournament?.liveGolfAPITournamentId
        ? `/api/scores/live?eventId=${activeTournament.liveGolfAPITournamentId}`
        : null;
    if (!url || isRefreshing) return;

    setIsRefreshing(true);

    try {
      const response = await fetch(url);
      const result = await response.json();

      if (result.data) {
        setLiveScores(result.data);
        setLiveSource(result.source === 'espn' ? 'espn' : 'rapidapi');
        const round = result.currentRound ?? result.current_round;
        if (round != null) {
          const n = typeof round === 'number' ? round : (typeof round === 'object' && round?.$numberInt != null ? parseInt(round.$numberInt, 10) : null);
          if (typeof n === 'number' && n >= 1) setLiveRound(n);
        }
        if (result.cutLine && typeof result.cutLine === 'object') setLiveCutLine(result.cutLine);
      }
    } catch (error) {
      console.error('[LiveSeasonStandings] Error:', error);
    } finally {
      setIsRefreshing(false);
      setNextRefreshIn(REFRESH_INTERVAL_MS / 1000);
    }
  }, [activeTournament, isRefreshing]);

  // Initial load
  useEffect(() => {
    if (!hasInitialLoaded.current) {
      hasInitialLoaded.current = true;
      fetchActiveRosters();
      fetchLiveScores();
    }
  }, [fetchActiveRosters, fetchLiveScores]);

  // Polling interval
  useEffect(() => {
    const pollInterval = setInterval(fetchLiveScores, REFRESH_INTERVAL_MS);
    const countdownInterval = setInterval(() => {
      setNextRefreshIn((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(countdownInterval);
    };
  }, [fetchLiveScores]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Find user's rank and standing
  const userStandingIndex = combinedStandings.findIndex((s) => s.user_id === currentUserId);
  const userRank = userStandingIndex !== -1 ? userStandingIndex + 1 : null;
  const userStanding = userStandingIndex !== -1 ? combinedStandings[userStandingIndex] : null;

  // Winner + Top 5 / Top 10 / Top 25: count of roster golfers who finished in each tier (not league rank)
  const topFinishesByUser = useMemo(() => {
    const userStats = new Map<string, { wins: number; top5: number; top10: number; top25: number }>();
    combinedStandings.forEach((s) => {
      userStats.set(s.user_id, { wins: 0, top5: 0, top10: 0, top25: 0 });
    });

    combinedStandings.forEach((standing) => {
      const stats = userStats.get(standing.user_id);
      if (!stats) return;
      standing.rosters.forEach((roster) => {
        const positions = roster.player_positions ?? [];
        positions.forEach((pos) => {
          if (pos === 1) stats.wins += 1;
          if (pos <= 5) stats.top5 += 1;
          if (pos <= 10) stats.top10 += 1;
          if (pos <= 25) stats.top25 += 1;
        });
      });
    });
    return userStats;
  }, [combinedStandings]);

  // Per-tournament: league rank (by winnings) + best tier from roster's golfer positions (W/T5/T10/T25)
  const userTournamentFinishes = useMemo(() => {
    const finishes = new Map<string, { rank: number; total: number; topTier: 'W' | 'T5' | 'T10' | 'T25' | null }>();
    const byTournament = new Map<string, { user_id: string; winnings: number }[]>();
    combinedStandings.forEach((standing) => {
      standing.rosters.forEach((roster) => {
        const tid = roster.tournament_id;
        if (!tid) return;
        if (!byTournament.has(tid)) byTournament.set(tid, []);
        byTournament.get(tid)!.push({
          user_id: standing.user_id,
          winnings: roster.winnings,
        });
      });
    });

    for (const [tournamentId, entries] of byTournament.entries()) {
      const sorted = entries.slice().sort((a, b) => b.winnings - a.winnings);
      const total = sorted.length;
      if (total === 0) continue;

      const index = sorted.findIndex((e) => e.user_id === currentUserId);
      if (index === -1) continue;

      const rank = index + 1;
      // Best tier from current user's roster golfer positions in this tournament
      const userRoster = combinedStandings
        .find((s) => s.user_id === currentUserId)
        ?.rosters.find((r) => r.tournament_id === tournamentId);
      const positions = userRoster?.player_positions ?? [];
      let topTier: 'W' | 'T5' | 'T10' | 'T25' | null = null;
      if (positions.some((p) => p === 1)) topTier = 'W';
      else if (positions.some((p) => p <= 5)) topTier = 'T5';
      else if (positions.some((p) => p <= 10)) topTier = 'T10';
      else if (positions.some((p) => p <= 25)) topTier = 'T25';

      finishes.set(tournamentId, { rank, total, topTier });
    }
    return finishes;
  }, [combinedStandings, currentUserId]);

  // Per-tournament for every user (member modal): league rank/total + best tier from roster's golfer positions
  const tournamentFinishesByUser = useMemo(() => {
    const byUser = new Map<string, Map<string, { rank: number; total: number; topTier: 'W' | 'T5' | 'T10' | 'T25' | null }>>();
    const byTournament = new Map<string, { user_id: string; winnings: number }[]>();
    combinedStandings.forEach((standing) => {
      standing.rosters.forEach((roster) => {
        const tid = roster.tournament_id;
        if (!tid) return;
        if (!byTournament.has(tid)) byTournament.set(tid, []);
        byTournament.get(tid)!.push({
          user_id: standing.user_id,
          winnings: roster.winnings,
        });
      });
    });

    for (const [tournamentId, entries] of byTournament.entries()) {
      const sorted = entries.slice().sort((a, b) => b.winnings - a.winnings);
      const total = sorted.length;
      if (total === 0) continue;

      sorted.forEach((entry, index) => {
        const rank = index + 1;
        const userRoster = combinedStandings
          .find((s) => s.user_id === entry.user_id)
          ?.rosters.find((r) => r.tournament_id === tournamentId);
        const positions = userRoster?.player_positions ?? [];
        let topTier: 'W' | 'T5' | 'T10' | 'T25' | null = null;
        if (positions.some((p) => p === 1)) topTier = 'W';
        else if (positions.some((p) => p <= 5)) topTier = 'T5';
        else if (positions.some((p) => p <= 10)) topTier = 'T10';
        else if (positions.some((p) => p <= 25)) topTier = 'T25';
        if (!byUser.has(entry.user_id)) byUser.set(entry.user_id, new Map());
        byUser.get(entry.user_id)!.set(tournamentId, { rank, total, topTier });
      });
    }
    return byUser;
  }, [combinedStandings]);

  // Generate period options based on segment definitions
  const periodOptions = useMemo(() => {
    const options: Array<{ value: SeasonPeriod; label: string }> = [
      { value: 'full', label: 'Full Season' },
    ];
    
    // Add segment options with custom names
    segmentDefinitions.forEach(seg => {
      options.push({ value: seg.number, label: seg.name });
    });
    
    return options;
  }, [segmentDefinitions]);

  const getPeriodLabel = (period: SeasonPeriod): string => {
    if (period === 'full') return 'Full Season';
    const segDef = segmentDefinitions.find(s => s.number === period);
    return segDef?.name || `Segment ${period}`;
  };

  // Close member modal on Escape
  useEffect(() => {
    if (!selectedMember) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedMember(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedMember]);

  return (
    <div className="pb-24">
      {/* Period Toggle */}
      <div className="mb-6 flex flex-wrap gap-2">
        {periodOptions.map(({ value, label }) => (
          <button
            key={String(value)}
            onClick={() => setSelectedPeriod(value)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              selectedPeriod === value
                ? 'bg-casino-gold text-casino-dark'
                : 'bg-casino-elevated text-casino-gray hover:bg-casino-gold/20 hover:text-casino-gold border border-casino-gold/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Live Status Bar */}
      {activeTournament && (
        <div className="mb-6 flex items-center justify-between p-2 bg-casino-elevated rounded-lg border border-casino-gold/20">
          <div className="flex items-center gap-2 text-xs text-casino-gray">
            <span className="text-green-500">●</span>
            <span>Live: {activeTournament.name}</span>
            <span className="text-casino-gray-dark">|</span>
            <span>Next refresh: {formatCountdown(nextRefreshIn)}</span>
          </div>
          <button
            onClick={fetchLiveScores}
            disabled={isRefreshing}
            className="text-xs px-3 py-1 bg-casino-gold/20 hover:bg-casino-gold/30 text-casino-gold rounded disabled:opacity-50 transition-colors"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      )}

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
                  #{userRank} <span className="text-xl text-casino-gray-dark">of {combinedStandings.length}</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-casino-gray mb-1">Total Winnings</p>
                <p className="text-3xl font-bold text-casino-green font-orbitron">
                  {formatCurrency(userStanding.total_winnings)}
                </p>
                {userStanding.live_winnings > 0 && (
                  <p className="text-xs text-casino-gray mt-1">
                    Includes {formatCurrency(userStanding.live_winnings)} live
                  </p>
                )}
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
          <CardTitle>{getPeriodLabel(selectedPeriod)} Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {combinedStandings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-casino-gold/30">
                    <th className="px-px sm:px-2 py-1.5 text-left text-xs font-medium text-casino-gray uppercase">Rank</th>
                    <th className="px-px sm:px-2 py-1.5 text-left text-xs font-medium text-casino-gray uppercase">Player</th>
                    <th className="px-1 sm:px-4 py-1.5 text-center text-xs font-medium text-casino-gray uppercase hidden sm:table-cell">Tournaments</th>
                    <th className="px-1 sm:px-4 py-1.5 text-right text-xs font-medium text-casino-gray uppercase" title="Wins / Top 5 / Top 10 / Top 25 finishes">W · T5 · T10 · T25</th>
                    <th className="px-1 sm:px-4 py-1.5 text-right text-xs font-medium text-casino-gray uppercase">Winnings</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedStandings.map((standing, index) => {
                    const rank = index + 1;
                    const isUser = standing.user_id === currentUserId;
                    const topFinishes = topFinishesByUser.get(standing.user_id);
                    const topDisplay = topFinishes
                      ? `${topFinishes.wins} / ${topFinishes.top5} / ${topFinishes.top10} / ${topFinishes.top25}`
                      : '—';

                    return (
                      <tr
                        key={standing.user_id}
                        className={`border-b border-casino-gold/20 transition-colors ${
                          isUser ? 'bg-casino-green/10 hover:bg-casino-green/20' : 'hover:bg-casino-elevated'
                        }`}
                      >
                        <td className="px-px sm:px-2 py-1.5">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <span className="text-xs sm:text-sm font-medium text-casino-text">{rank}</span>
                            {rank === 1 && <span className="text-base sm:text-lg">🏆</span>}
                            {isUser && (
                              <span className="px-1.5 py-0.5 bg-casino-green/30 text-casino-green border border-casino-green/50 rounded text-xs font-medium">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-px sm:px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedMember({ user_id: standing.user_id, username: standing.username })}
                            className="font-medium text-casino-text text-xs sm:text-sm hover:text-casino-gold hover:underline focus:outline-none focus:ring-1 focus:ring-casino-gold rounded text-left"
                          >
                            {standing.username}
                          </button>
                        </td>
                        <td className="px-1 sm:px-4 py-1.5 text-center text-xs sm:text-sm text-casino-gray hidden sm:table-cell">
                          {standing.tournaments_played}
                        </td>
                        <td className="px-1 sm:px-4 py-1.5 text-right text-xs sm:text-sm text-casino-gray tabular-nums">
                          {topDisplay}
                        </td>
                        <td className="px-1 sm:px-4 py-1.5 text-right">
                          <span className="font-semibold text-casino-green text-xs sm:text-sm">
                            {formatCurrency(standing.total_winnings)}
                          </span>
                          {standing.live_winnings > 0 && (
                            <span className="hidden sm:block text-xs text-casino-gray">
                              +{formatCurrency(standing.live_winnings)} live
                            </span>
                          )}
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
                .map((roster, index) => {
                  const finish = roster.tournament_id ? userTournamentFinishes.get(roster.tournament_id) : null;
                  const positions = roster.player_positions ?? [];
                  const eventWins = positions.filter((p) => p === 1).length;
                  const eventTop5 = positions.filter((p) => p <= 5).length;
                  const eventTop10 = positions.filter((p) => p <= 10).length;
                  const eventTop25 = positions.filter((p) => p <= 25).length;
                  const hasTierData = positions.length > 0;
                  const cardContent = (
                    <>
                      <div className="min-w-0">
                        <p className="font-medium text-casino-text">
                          {roster.tournament_name}
                          {roster.is_active && (
                            <span className="ml-2 text-xs text-casino-green">● Live</span>
                          )}
                        </p>
                        <div className="text-xs text-casino-gray-dark mt-0.5 space-y-0.5">
                          {finish && (
                            <p className="flex items-center gap-1.5 flex-wrap">
                              <span>Finish: {finish.rank}/{finish.total}</span>
                            </p>
                          )}
                          {hasTierData && (
                            <p className="flex items-center gap-1.5 flex-wrap" title="Your roster golfers in each tier this tournament">
                              <span className="text-casino-gray">W · T5 · T10 · T25:</span>
                              <span className="font-medium text-casino-text">
                                {eventWins} / {eventTop5} / {eventTop10} / {eventTop25}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-semibold text-casino-green font-orbitron">
                          {formatCurrency(roster.winnings)}
                        </p>
                      </div>
                    </>
                  );
                  const cardClass = `flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    roster.is_active
                      ? 'bg-casino-green/10 border-casino-green/30'
                      : 'bg-casino-card/50 border-casino-gold/10 hover:border-casino-gold/30'
                  }`;
                  return roster.tournament_id ? (
                    <Link
                      key={index}
                      href={`/standings/weekly/${roster.tournament_id}`}
                      className={`${cardClass} hover:border-casino-gold/40 block`}
                    >
                      {cardContent}
                    </Link>
                  ) : (
                    <div key={index} className={cardClass}>
                      {cardContent}
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Member tournament breakdown modal */}
      {selectedMember && (() => {
        const memberStanding = combinedStandings.find((s) => s.user_id === selectedMember.user_id);
        const memberFinishes = tournamentFinishesByUser.get(selectedMember.user_id);
        const memberTops = topFinishesByUser.get(selectedMember.user_id);
        return (
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-modal-title"
          >
            <div
              className="absolute inset-0 bg-black/80"
              onClick={() => setSelectedMember(null)}
            />
            <div
              className="relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-xl border border-casino-gold/30 bg-casino-card shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-casino-gold/20 shrink-0 space-y-1">
                <div className="flex items-center justify-between">
                  <h2 id="member-modal-title" className="text-lg font-bold text-casino-gold">
                    {selectedMember.username}&apos;s Tournament Breakdown
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSelectedMember(null)}
                    className="p-2 rounded-lg text-casino-gray hover:bg-casino-elevated hover:text-casino-text transition-colors focus:outline-none focus:ring-1 focus:ring-casino-gold"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {memberTops && (memberTops.wins > 0 || memberTops.top5 > 0 || memberTops.top10 > 0 || memberTops.top25 > 0) && (
                  <p className="text-xs text-casino-gray">
                    {memberTops.wins} Win{memberTops.wins !== 1 ? 's' : ''}
                    {' · '}
                    {memberTops.top5} Top 5{memberTops.top5 !== 1 ? 's' : ''}
                    {' · '}
                    {memberTops.top10} Top 10{memberTops.top10 !== 1 ? 's' : ''}
                    {' · '}
                    {memberTops.top25} Top 25{memberTops.top25 !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <div className="p-4 overflow-y-auto space-y-3">
                {memberStanding && memberStanding.rosters.length > 0 ? (
                  [...memberStanding.rosters]
                    .sort((a, b) => b.winnings - a.winnings)
                    .map((roster, index) => {
                      const finish = roster.tournament_id ? memberFinishes?.get(roster.tournament_id) : null;
                      const positions = roster.player_positions ?? [];
                      const eventWins = positions.filter((p) => p === 1).length;
                      const eventTop5 = positions.filter((p) => p <= 5).length;
                      const eventTop10 = positions.filter((p) => p <= 10).length;
                      const eventTop25 = positions.filter((p) => p <= 25).length;
                      const hasTierData = positions.length > 0;
                      const rowClass = `flex items-center justify-between p-3 rounded-lg border ${
                        roster.is_active
                          ? 'bg-casino-green/10 border-casino-green/30'
                          : 'bg-casino-elevated/50 border-casino-gold/10'
                      }`;
                      const rowContent = (
                        <>
                          <div className="min-w-0">
                            <p className="font-medium text-casino-text">
                              {roster.tournament_name}
                              {roster.is_active && (
                                <span className="ml-2 text-xs text-casino-green">● Live</span>
                              )}
                            </p>
                            <div className="text-xs text-casino-gray-dark mt-0.5 space-y-0.5">
                              {finish && (
                                <p className="flex items-center gap-1.5 flex-wrap">
                                  <span>Finish: {finish.rank}/{finish.total}</span>
                                </p>
                              )}
                              {hasTierData && (
                                <p className="flex items-center gap-1.5 flex-wrap" title="Roster golfers in each tier this tournament">
                                  <span className="text-casino-gray">W · T5 · T10 · T25:</span>
                                  <span className="font-medium text-casino-text">
                                    {eventWins} / {eventTop5} / {eventTop10} / {eventTop25}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="font-semibold text-casino-green font-orbitron">
                              {formatCurrency(roster.winnings)}
                            </p>
                          </div>
                        </>
                      );
                      return roster.tournament_id ? (
                        <Link
                          key={index}
                          href={`/standings/weekly/${roster.tournament_id}`}
                          className={`${rowClass} hover:border-casino-gold/30 block`}
                        >
                          {rowContent}
                        </Link>
                      ) : (
                        <div key={index} className={rowClass}>
                          {rowContent}
                        </div>
                      );
                    })
                ) : (
                  <p className="text-casino-gray text-sm">No tournaments in this period.</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
