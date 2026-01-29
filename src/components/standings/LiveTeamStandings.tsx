'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/prize-money';
import { REFRESH_INTERVAL_MS } from '@/lib/config';
import { convertESTtoLocal } from '@/lib/timezone';

interface RosterData {
  id: string;
  roster_name: string;
  user_id: string;
  username: string;
  players: Array<{
    playerId: string;
    playerName: string;
    teeTimeR1?: string | null;
    teeTimeR2?: string | null;
    cost?: number;
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

interface LiveTeamStandingsProps {
  tournamentId: string;
  liveGolfAPITournamentId: string;
  prizeDistributions: Array<{
    position: number;
    amount: number;
  }>;
  currentUserId: string;
  tournamentStatus: string;
  userLeagueId?: string;
}

// Helper to parse scores
const parseScore = (score: string | number | null): number => {
  if (score === null || score === undefined) return 0;
  if (typeof score === 'number') return score;
  if (score === 'E') return 0;
  const s = score.toString().trim();
  if (s.startsWith('+')) return parseInt(s.slice(1), 10) || 0;
  if (s.startsWith('-')) return -parseInt(s.slice(1), 10) || 0;
  return parseInt(s, 10) || 0;
};

export function LiveTeamStandings({
  tournamentId,
  liveGolfAPITournamentId,
  prizeDistributions,
  currentUserId,
  tournamentStatus: _tournamentStatus,
  userLeagueId,
}: LiveTeamStandingsProps) {
  const [rosters, setRosters] = useState<RosterData[]>([]);
  const [liveScores, setLiveScores] = useState<LiveScore[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextRefreshIn, setNextRefreshIn] = useState(REFRESH_INTERVAL_MS / 1000);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [expandedRosterIds, setExpandedRosterIds] = useState<Set<string>>(new Set());
  const hasInitialLoaded = useRef(false);

  // Toggle a single roster expansion
  const toggleRoster = (rosterId: string) => {
    setExpandedRosterIds((prev) => {
      const next = new Set(prev);
      if (next.has(rosterId)) {
        next.delete(rosterId);
      } else {
        next.add(rosterId);
      }
      return next;
    });
  };

  // Expand all rosters
  const expandAll = () => {
    setExpandedRosterIds(new Set(rosters.map((r) => r.id)));
  };

  // Collapse all rosters
  const collapseAll = () => {
    setExpandedRosterIds(new Set());
  };

  // Prize distribution map
  const prizeMap = useMemo(
    () => new Map(prizeDistributions.map((d) => [d.position, d.amount])),
    [prizeDistributions]
  );

  // Normalize name for matching (handle accents, case, extra spaces)
  const normalizeName = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/\s+/g, ' '); // Normalize spaces
  };

  // Create a map of player name -> live score data with multiple lookup keys
  const playerScoreMap = useMemo(() => {
    const map = new Map<string, LiveScore>();
    liveScores.forEach((score) => {
      const normalizedName = normalizeName(score.player);
      map.set(normalizedName, score);
      
      // Also add lookup by last name for fuzzy matching
      const nameParts = normalizedName.split(' ');
      if (nameParts.length >= 2) {
        const lastName = nameParts[nameParts.length - 1];
        const firstName = nameParts[0];
        // Store "lastname_firstname" pattern for fuzzy lookup
        map.set(`__fuzzy__${lastName}__${firstName}`, score);
      }
    });
    return map;
  }, [liveScores]);

  // Find live score with fuzzy matching for nicknames like "Cam" vs "Cameron"
  const findLiveScore = useCallback((playerName: string): LiveScore | undefined => {
    const normalizedName = normalizeName(playerName);
    
    // Try exact match first
    let match = playerScoreMap.get(normalizedName);
    if (match) return match;
    
    // Try fuzzy matching by last name + first name starts with
    const nameParts = normalizedName.split(' ');
    if (nameParts.length >= 2) {
      const lastName = nameParts[nameParts.length - 1];
      const firstName = nameParts[0];
      
      // Look through all fuzzy keys
      for (const [key, score] of playerScoreMap.entries()) {
        if (key.startsWith('__fuzzy__')) {
          const [, fuzzyLastName, fuzzyFirstName] = key.split('__').filter(Boolean);
          // Match if last names match and one first name starts with the other
          if (fuzzyLastName === lastName) {
            if (firstName.startsWith(fuzzyFirstName) || fuzzyFirstName.startsWith(firstName)) {
              return score;
            }
          }
        }
      }
    }
    
    return undefined;
  }, [playerScoreMap]);

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

  // Calculate winnings for each roster based on live scores
  const rostersWithLiveWinnings = useMemo(() => {
    return rosters.map((roster) => {
      let totalWinnings = 0;
      const playersWithScores = roster.players.map((player) => {
        // Use fuzzy matching to find live score
        const liveScore = findLiveScore(player.playerName);
        
        const position = liveScore?.positionValue;
        
        // Calculate winnings with proper tie handling
        const winnings = calculateTiePrizeMoney(position || null);
        
        totalWinnings += winnings;

        return {
          ...player,
          liveScore,
          winnings,
        };
      });

      // Sort players by winnings (highest first)
      playersWithScores.sort((a, b) => b.winnings - a.winnings);

      return {
        ...roster,
        playersWithScores,
        totalWinnings,
      };
    }).sort((a, b) => b.totalWinnings - a.totalWinnings);
  }, [rosters, findLiveScore, calculateTiePrizeMoney]);

  // Fetch rosters from database
  const fetchRosters = useCallback(async () => {
    const supabase = createClient();
    
    // Get rosters with their players, filtered by league
    let query = supabase
      .from('user_rosters')
      .select(`
        id,
        roster_name,
        user_id,
        profiles!inner(username, active_league_id),
        roster_players(
          tournament_player:tournament_players(
            pga_player_id,
            tee_time_r1,
            tee_time_r2,
            cost,
            pga_players(name)
          )
        )
      `)
      .eq('tournament_id', tournamentId);

    // Filter by league if provided
    if (userLeagueId) {
      query = query.eq('profiles.active_league_id', userLeagueId);
    }

    const { data: rostersData, error } = await query;

    if (error) {
      console.error('Error fetching rosters:', error);
      return;
    }

    const transformedRosters: RosterData[] = (rostersData || []).map((r: any) => ({
      id: r.id,
      roster_name: r.roster_name,
      user_id: r.user_id,
      username: r.profiles?.username || 'Unknown',
      players: (r.roster_players || []).map((rp: any) => ({
        playerId: rp.tournament_player?.pga_player_id,
        playerName: rp.tournament_player?.pga_players?.name || 'Unknown',
        teeTimeR1: rp.tournament_player?.tee_time_r1,
        teeTimeR2: rp.tournament_player?.tee_time_r2,
        cost: rp.tournament_player?.cost,
      })),
    }));

    setRosters(transformedRosters);
  }, [tournamentId, userLeagueId]);

  // Fetch live scores from API
  const fetchLiveScores = useCallback(async () => {
    if (!liveGolfAPITournamentId || isRefreshing) return;

    setIsRefreshing(true);
    setSyncError(null);

    try {
      const response = await fetch(`/api/scores/live?eventId=${liveGolfAPITournamentId}`);
      const result = await response.json();

      if (!response.ok || !result.data) {
        setSyncError(result.error || 'Failed to fetch scores');
        return;
      }

      setLiveScores(result.data);
      console.log('[LiveTeamStandings] Refreshed scores at', new Date().toLocaleTimeString());
    } catch (error) {
      setSyncError('Network error - unable to refresh scores');
      console.error('[LiveTeamStandings] Error:', error);
    } finally {
      setIsRefreshing(false);
      setNextRefreshIn(REFRESH_INTERVAL_MS / 1000);
    }
  }, [liveGolfAPITournamentId, isRefreshing]);

  // Initial load
  useEffect(() => {
    if (!hasInitialLoaded.current) {
      hasInitialLoaded.current = true;
      fetchRosters();
      fetchLiveScores();
    }
  }, [fetchRosters, fetchLiveScores]);

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

  const userRank = rostersWithLiveWinnings.findIndex((r) => r.user_id === currentUserId) + 1;
  const userRoster = rostersWithLiveWinnings.find((r) => r.user_id === currentUserId);

  return (
    <div>
      {/* Refresh Status Bar */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between p-2 bg-casino-elevated rounded-lg border border-casino-gold/20">
          <div className="flex items-center gap-2 text-xs text-casino-gray">
            {isRefreshing ? (
              <>
                <span className="animate-spin">🔄</span>
                <span>Refreshing live scores...</span>
              </>
            ) : syncError ? (
              <>
                <span className="text-yellow-500">⚠</span>
                <span>Retry in {formatCountdown(nextRefreshIn)}</span>
              </>
            ) : (
              <>
                <span className="text-green-500">●</span>
                <span>Live updates active</span>
                <span className="text-casino-gray-dark">|</span>
                <span>Next refresh in {formatCountdown(nextRefreshIn)}</span>
              </>
            )}
          </div>
          <button
            onClick={fetchLiveScores}
            disabled={isRefreshing}
            className="text-xs px-3 py-1 bg-casino-gold/20 hover:bg-casino-gold/30 text-casino-gold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
        {syncError && (
          <div className="p-2 bg-yellow-900/30 border border-yellow-600/50 rounded-lg text-xs text-yellow-300">
            ⚠️ {syncError}
          </div>
        )}
      </div>

      {/* Expand/Collapse Toggle */}
      <div className="flex justify-end mb-3">
        <button
          onClick={expandedRosterIds.size === rosters.length ? collapseAll : expandAll}
          className="text-xs px-3 py-1 bg-casino-card hover:bg-casino-elevated text-casino-gray hover:text-casino-text border border-casino-gold/20 rounded transition-colors"
        >
          {expandedRosterIds.size === rosters.length ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* Standings Table */}
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
            {rostersWithLiveWinnings.map((roster, index) => {
              const isUserRoster = roster.user_id === currentUserId;
              const isExpanded = expandedRosterIds.has(roster.id);
              const rank = index + 1;

              return (
                <Fragment key={roster.id}>
                  <tr
                    className={`border-b border-casino-gold/20 transition-colors cursor-pointer ${
                      isUserRoster
                        ? 'bg-casino-green/10 hover:bg-casino-green/20'
                        : 'hover:bg-casino-card/50'
                    }`}
                    onClick={() => toggleRoster(roster.id)}
                  >
                    <td className="px-1 sm:px-2 py-1.5">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button className="p-0.5 hover:bg-casino-gold/20 rounded transition-colors">
                          <svg
                            className={`w-3 h-3 sm:w-4 sm:h-4 text-casino-gold transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <span className="text-xs sm:text-sm font-medium text-casino-text">{rank}</span>
                        {rank === 1 && <span className="text-sm sm:text-base">🏆</span>}
                        {isUserRoster && (
                          <span className="px-1 sm:px-1.5 py-0.5 bg-casino-green/30 text-casino-green border border-casino-green/50 rounded text-xs font-medium">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-1 sm:px-2 py-1.5">
                      <span className="font-medium text-casino-text text-xs sm:text-sm">{roster.roster_name}</span>
                    </td>
                    <td className="px-1 sm:px-2 py-1.5 text-right">
                      <span className={`font-semibold text-xs sm:text-sm ${roster.totalWinnings > 0 ? 'text-casino-green' : 'text-casino-gray-dark'}`}>
                        {formatCurrency(roster.totalWinnings)}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded Player Details */}
                  {isExpanded && (
                    <tr className={isUserRoster ? 'bg-casino-green/5' : 'bg-casino-elevated'}>
                      <td colSpan={3} className="px-1 sm:px-2 py-2">
                        <div className="pl-2 sm:pl-6">
                          <h4 className="text-xs font-semibold text-casino-gold uppercase mb-1.5">
                            Team Roster ({roster.playersWithScores.length} players)
                          </h4>
                          <div className="overflow-x-auto -mx-1 sm:mx-0">
                            <table className="min-w-full text-xs sm:text-sm">
                              <thead className="bg-casino-card border-b border-casino-gold/20">
                                <tr>
                                  <th className="px-1 sm:px-2 py-1 text-left text-xs font-medium text-casino-gray uppercase">Player</th>
                                  <th className="px-1 sm:px-2 py-1 text-center text-xs font-medium text-casino-gray uppercase">Pos</th>
                                  <th className="px-1 sm:px-2 py-1 text-center text-xs font-medium text-casino-gray uppercase hidden sm:table-cell">Score</th>
                                  <th className="px-1 sm:px-2 py-1 text-center text-xs font-medium text-casino-gray uppercase hidden md:table-cell">Thru</th>
                                  <th className="px-1 sm:px-2 py-1 text-right text-xs font-medium text-casino-gray uppercase">Win</th>
                                </tr>
                              </thead>
                              <tbody className="bg-casino-bg divide-y divide-casino-gold/10">
                                {roster.playersWithScores.map((player, idx) => (
                                  <tr key={idx} className="hover:bg-casino-card/50 transition-colors">
                                    <td className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm text-casino-text">
                                      <span className="truncate">
                                        {player.playerName}
                                        {player.cost !== undefined && player.cost !== null && (
                                          <span className="text-casino-gray font-normal ml-1">(${player.cost})</span>
                                        )}
                                      </span>
                                    </td>
                                    <td className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm text-center">
                                      {player.liveScore?.position ? (
                                        <span className={`font-medium ${
                                          player.liveScore.positionValue === 1 ? 'text-casino-gold' :
                                          (player.liveScore.positionValue || 999) <= 10 ? 'text-casino-green' :
                                          'text-casino-text'
                                        }`}>
                                          {player.liveScore.position}
                                        </span>
                                      ) : (
                                        <span className="text-casino-gray-dark">-</span>
                                      )}
                                    </td>
                                    <td className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm text-center hidden sm:table-cell">
                                      {player.liveScore ? (
                                        <span className={
                                          parseScore(player.liveScore.total) < 0 ? 'text-casino-green' :
                                          parseScore(player.liveScore.total) > 0 ? 'text-casino-red' :
                                          'text-casino-gray'
                                        }>
                                          {player.liveScore.total}
                                        </span>
                                      ) : (
                                        <span className="text-casino-gray-dark">-</span>
                                      )}
                                    </td>
                                    <td className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm text-center hidden md:table-cell">
                                      {player.liveScore?.thru === 'F' ? (
                                        <span className="text-casino-green font-medium">F</span>
                                      ) : player.liveScore?.thru && player.liveScore.thru !== '-' && player.liveScore.thru !== '0' ? (
                                        <span className="text-casino-blue">{player.liveScore.thru}</span>
                                      ) : player.teeTimeR1 ? (
                                        <span className="text-casino-gray">{convertESTtoLocal(player.teeTimeR1)}</span>
                                      ) : (
                                        <span className="text-casino-gray-dark">-</span>
                                      )}
                                    </td>
                                    <td className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm text-right">
                                      <span className={player.winnings > 0 ? 'text-casino-green font-semibold' : 'text-casino-gray-dark'}>
                                        {formatCurrency(player.winnings)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* User's Rank Summary */}
      {userRank > 0 && userRoster && (
        <div className="mt-6 p-4 bg-casino-card border-2 border-casino-green/30 rounded-lg">
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div>
              <p className="text-xs sm:text-sm text-casino-gray mb-1">Your Rank</p>
              <p className="text-xl sm:text-2xl font-bold text-casino-gold font-orbitron">
                #{userRank} <span className="text-base sm:text-xl text-casino-gray-dark">of {rostersWithLiveWinnings.length}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs sm:text-sm text-casino-gray mb-1">Your Winnings</p>
              <p className="text-xl sm:text-2xl font-bold text-casino-green font-orbitron">
                {formatCurrency(userRoster.totalWinnings)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
