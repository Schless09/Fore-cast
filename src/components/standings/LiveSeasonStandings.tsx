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

  // Quartile distribution (Q1–Q4) for each user across tournaments in the selected period
  const quartileStatsByUser = useMemo(() => {
    // Build per-tournament standings from combinedStandings (which already respects selectedPeriod and live winnings)
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

    // Initialize user stats
    const userStats = new Map<
      string,
      { totalEvents: number; counts: [number, number, number, number] }
    >();
    combinedStandings.forEach((s) => {
      userStats.set(s.user_id, { totalEvents: 0, counts: [0, 0, 0, 0] });
    });

    // For each tournament, rank users by winnings and assign quartiles
    for (const [, entries] of byTournament.entries()) {
      const validEntries = entries.slice().sort((a, b) => b.winnings - a.winnings);
      const n = validEntries.length;
      if (n === 0) continue;

      validEntries.forEach((entry, index) => {
        const stats = userStats.get(entry.user_id);
        if (!stats) return;

        const fraction = index / n;
        let qIndex: 0 | 1 | 2 | 3;
        if (fraction < 0.25) qIndex = 0; // Q1 (top 25%)
        else if (fraction < 0.5) qIndex = 1; // Q2
        else if (fraction < 0.75) qIndex = 2; // Q3
        else qIndex = 3; // Q4

        stats.totalEvents += 1;
        stats.counts[qIndex] += 1;
      });
    }

    return userStats;
  }, [combinedStandings]);

  // Per-tournament finish + quartile for the current user (used in breakdown section)
  const userTournamentFinishes = useMemo(() => {
    const finishes = new Map<string, { rank: number; total: number; quartileLabel: string }>();

    // Rebuild per-tournament standings from combinedStandings
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

      const fraction = index / total;
      let quartileLabel = 'Q4 (Bottom 25%)';
      if (fraction < 0.25) quartileLabel = 'Q1 (Top 25%)';
      else if (fraction < 0.5) quartileLabel = 'Q2 (25–50%)';
      else if (fraction < 0.75) quartileLabel = 'Q3 (50–75%)';

      finishes.set(tournamentId, {
        rank: index + 1,
        total,
        quartileLabel,
      });
    }

    return finishes;
  }, [combinedStandings, currentUserId]);

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
            <>
              {/* Mobile: stacked cards so nothing scrunches */}
              <div className="sm:hidden space-y-2">
                {combinedStandings.map((standing, index) => {
                  const rank = index + 1;
                  const isUser = standing.user_id === currentUserId;
                  const quartileStats = quartileStatsByUser.get(standing.user_id);
                  const quartileParts = quartileStats && quartileStats.totalEvents > 0
                    ? quartileStats.counts
                        .map((count, i) => ({ label: ['Q1', 'Q2', 'Q3', 'Q4'][i], pct: Math.round((count / quartileStats.totalEvents) * 100), count }))
                        .filter((p) => p.count > 0)
                    : [];

                  return (
                    <div
                      key={standing.user_id}
                      className={`rounded-lg border p-3 ${
                        isUser ? 'bg-casino-green/10 border-casino-green/30' : 'bg-casino-card/50 border-casino-gold/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-casino-text shrink-0">{rank}</span>
                          {rank === 1 && <span className="shrink-0">🏆</span>}
                          <span className="font-medium text-casino-text truncate">{standing.username}</span>
                          {isUser && (
                            <span className="px-1.5 py-0.5 bg-casino-green/30 text-casino-green border border-casino-green/50 rounded text-xs font-medium shrink-0">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-semibold text-casino-green text-sm">
                            {formatCurrency(standing.total_winnings)}
                          </span>
                          {standing.live_winnings > 0 && (
                            <span className="text-xs text-casino-gray ml-1">+{formatCurrency(standing.live_winnings)} live</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {quartileParts.length > 0 ? (
                          quartileParts.map((p) => (
                            <span key={p.label} className="text-xs text-casino-gray bg-casino-elevated px-2 py-0.5 rounded">
                              {p.label} {p.pct}%
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-casino-gray-dark">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-casino-gold/30">
                      <th className="px-1 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase">Rank</th>
                      <th className="px-1 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase">Player</th>
                      <th className="px-1 sm:px-4 py-2 text-right text-xs font-medium text-casino-gray uppercase">Winnings</th>
                      <th className="px-1 sm:px-4 py-2 text-center text-xs font-medium text-casino-gray uppercase hidden sm:table-cell">Tournaments</th>
                      <th className="px-1 sm:px-4 py-2 text-right text-xs font-medium text-casino-gray uppercase">Quartiles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedStandings.map((standing, index) => {
                      const rank = index + 1;
                      const isUser = standing.user_id === currentUserId;
                      const quartileStats = quartileStatsByUser.get(standing.user_id);
                      let quartileDisplay = '—';
                      if (quartileStats && quartileStats.totalEvents > 0) {
                        const labels = ['Q1', 'Q2', 'Q3', 'Q4'];
                        const parts = quartileStats.counts
                          .map((count, i) => ({
                            label: labels[i],
                            count,
                            pct: Math.round((count / quartileStats.totalEvents) * 100),
                          }))
                          .filter((p) => p.count > 0)
                          .slice(0, 3);
                        if (parts.length > 0) {
                          quartileDisplay = parts
                            .map((p) => `${p.label} ${p.pct}%`)
                            .join(' · ');
                        }
                      }

                      return (
                        <tr
                          key={standing.user_id}
                          className={`border-b border-casino-gold/10 transition-colors ${
                            isUser ? 'bg-casino-green/10 hover:bg-casino-green/20' : 'hover:bg-casino-elevated'
                          }`}
                        >
                          <td className="px-1 sm:px-4 py-3">
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
                          <td className="px-1 sm:px-4 py-3">
                            <span className="font-medium text-casino-text text-xs sm:text-sm">{standing.username}</span>
                          </td>
                          <td className="px-1 sm:px-4 py-3 text-right">
                            <span className="font-semibold text-casino-green text-xs sm:text-sm">
                              {formatCurrency(standing.total_winnings)}
                            </span>
                            {standing.live_winnings > 0 && (
                              <span className="block text-xs text-casino-gray">
                                +{formatCurrency(standing.live_winnings)} live
                              </span>
                            )}
                          </td>
                          <td className="px-1 sm:px-4 py-3 text-center text-xs sm:text-sm text-casino-gray hidden sm:table-cell">
                            {standing.tournaments_played}
                          </td>
                          <td className="px-1 sm:px-4 py-3 text-right text-xs sm:text-sm text-casino-gray">
                            {quartileDisplay}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
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
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      roster.is_active
                        ? 'bg-casino-green/10 border-casino-green/30'
                        : 'bg-casino-card/50 border-casino-gold/10 hover:border-casino-gold/30'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-casino-text">
                        {roster.roster_name}
                        {roster.is_active && (
                          <span className="ml-2 text-xs text-casino-green">● Live</span>
                        )}
                      </p>
                      <p className="text-sm text-casino-gray">{roster.tournament_name}</p>
                      {roster.tournament_id && (
                        (() => {
                          const finish = userTournamentFinishes.get(roster.tournament_id);
                          if (!finish) return null;
                          return (
                            <p className="text-xs text-casino-gray-dark mt-0.5">
                              Finish: {finish.rank}/{finish.total} · {finish.quartileLabel}
                            </p>
                          );
                        })()
                      )}
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
