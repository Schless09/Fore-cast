'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/prize-money';
import { REFRESH_INTERVAL_MS } from '@/lib/config';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

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

interface LiveScore {
  player: string;
  playerId: string;
  position: string;
  positionValue: number | null;
  total: string;
  thru: string;
  currentRoundScore: string;
}

interface LiveSeasonStandingsProps {
  completedStandings: CompletedStanding[];
  currentUserId: string;
  activeTournament?: {
    id: string;
    name: string;
    liveGolfAPITournamentId: string;
  };
  prizeDistributions: Array<{
    position: number;
    amount: number;
  }>;
  userLeagueId?: string;
}

// Normalize name for matching
const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
};

export function LiveSeasonStandings({
  completedStandings,
  currentUserId,
  activeTournament,
  prizeDistributions,
  userLeagueId,
}: LiveSeasonStandingsProps) {
  const [liveScores, setLiveScores] = useState<LiveScore[]>([]);
  const [activeRosters, setActiveRosters] = useState<Map<string, { rosterId: string; rosterName: string; playerNames: string[] }>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextRefreshIn, setNextRefreshIn] = useState(REFRESH_INTERVAL_MS / 1000);
  const hasInitialLoaded = useRef(false);

  // Prize distribution map
  const prizeMap = useMemo(
    () => new Map(prizeDistributions.map((d) => [d.position, d.amount])),
    [prizeDistributions]
  );

  // Create a map of player name -> live score data
  const playerScoreMap = useMemo(() => {
    const map = new Map<string, LiveScore>();
    liveScores.forEach((score) => {
      const normalizedName = normalizeName(score.player);
      map.set(normalizedName, score);
    });
    return map;
  }, [liveScores]);

  // Count players at each position to detect ties
  const positionCounts = useMemo(() => {
    const counts = new Map<number, number>();
    liveScores.forEach((score) => {
      const position = score.positionValue;
      if (position && position > 0) {
        counts.set(position, (counts.get(position) || 0) + 1);
      }
    });
    return counts;
  }, [liveScores]);

  // Helper to calculate prize money with proper tie handling
  const calculateTiePrizeMoney = useCallback((position: number | null): number => {
    if (!position || position < 1) return 0;
    
    const tieCount = positionCounts.get(position) || 1;
    
    // Sum prize money for positions position through position + tieCount - 1
    let totalPrize = 0;
    for (let i = 0; i < tieCount; i++) {
      const pos = position + i;
      totalPrize += prizeMap.get(pos) || 0;
    }
    
    // Split evenly among tied players
    return Math.round(totalPrize / tieCount);
  }, [positionCounts, prizeMap]);

  // Calculate live winnings for a roster
  const calculateLiveWinnings = useCallback((playerNames: string[]): number => {
    let total = 0;
    playerNames.forEach((name) => {
      const normalizedName = normalizeName(name);
      const liveScore = playerScoreMap.get(normalizedName);
      const position = liveScore?.positionValue;
      if (position && position > 0) {
        // Use tie-aware prize calculation
        total += calculateTiePrizeMoney(position);
      }
    });
    return total;
  }, [playerScoreMap, calculateTiePrizeMoney]);

  // Combined standings with live data
  const combinedStandings = useMemo(() => {
    return completedStandings.map((standing) => {
      // Check if user has an active roster
      const activeRoster = activeRosters.get(standing.user_id);
      let liveWinnings = 0;
      
      if (activeRoster && activeTournament) {
        liveWinnings = calculateLiveWinnings(activeRoster.playerNames);
      }

      const totalWinnings = standing.completed_winnings + liveWinnings;

      // Update rosters with live winnings for active tournament
      const updatedRosters = standing.rosters.map((roster) => {
        if (roster.is_active && activeRoster) {
          return { ...roster, winnings: liveWinnings };
        }
        return roster;
      });

      return {
        ...standing,
        total_winnings: totalWinnings,
        live_winnings: liveWinnings,
        rosters: updatedRosters,
      };
    }).sort((a, b) => b.total_winnings - a.total_winnings);
  }, [completedStandings, activeRosters, activeTournament, calculateLiveWinnings]);

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
        profiles!inner(active_league_id),
        roster_players(
          tournament_player:tournament_players(
            pga_players(name)
          )
        )
      `)
      .eq('tournament_id', activeTournament.id);

    if (userLeagueId) {
      query = query.eq('profiles.active_league_id', userLeagueId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching active rosters:', error);
      return;
    }

    const rostersMap = new Map<string, { rosterId: string; rosterName: string; playerNames: string[] }>();
    
    (data || []).forEach((roster: any) => {
      const playerNames = (roster.roster_players || [])
        .map((rp: any) => rp.tournament_player?.pga_players?.name)
        .filter(Boolean);
      
      rostersMap.set(roster.user_id, {
        rosterId: roster.id,
        rosterName: roster.roster_name,
        playerNames,
      });
    });

    setActiveRosters(rostersMap);
  }, [activeTournament, userLeagueId]);

  // Fetch live scores from API
  const fetchLiveScores = useCallback(async () => {
    if (!activeTournament?.liveGolfAPITournamentId || isRefreshing) return;

    setIsRefreshing(true);

    try {
      const response = await fetch(`/api/scores/live?eventId=${activeTournament.liveGolfAPITournamentId}`);
      const result = await response.json();

      if (result.data) {
        setLiveScores(result.data);
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

  return (
    <div>
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
          <CardTitle>Season Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {combinedStandings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-casino-gold/30">
                    <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase">Rank</th>
                    <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase">Player</th>
                    <th className="px-2 sm:px-4 py-2 text-right text-xs font-medium text-casino-gray uppercase">Winnings</th>
                    <th className="px-2 sm:px-4 py-2 text-center text-xs font-medium text-casino-gray uppercase hidden sm:table-cell">Tournaments</th>
                    <th className="px-2 sm:px-4 py-2 text-right text-xs font-medium text-casino-gray uppercase hidden md:table-cell">Avg.</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedStandings.map((standing, index) => {
                    const rank = index + 1;
                    const isUser = standing.user_id === currentUserId;
                    const avgWinnings = standing.tournaments_played > 0
                      ? standing.total_winnings / standing.tournaments_played
                      : 0;

                    return (
                      <tr
                        key={standing.user_id}
                        className={`border-b border-casino-gold/10 transition-colors ${
                          isUser ? 'bg-casino-green/10 hover:bg-casino-green/20' : 'hover:bg-casino-elevated'
                        }`}
                      >
                        <td className="px-2 sm:px-4 py-3">
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
                        <td className="px-2 sm:px-4 py-3">
                          <span className="font-medium text-casino-text text-xs sm:text-sm">{standing.username}</span>
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-right">
                          <span className="font-semibold text-casino-green text-xs sm:text-sm">
                            {formatCurrency(standing.total_winnings)}
                          </span>
                          {standing.live_winnings > 0 && (
                            <span className="block text-xs text-casino-gray">
                              +{formatCurrency(standing.live_winnings)} live
                            </span>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm text-casino-gray hidden sm:table-cell">
                          {standing.tournaments_played}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-right text-xs sm:text-sm text-casino-gray hidden md:table-cell">
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
