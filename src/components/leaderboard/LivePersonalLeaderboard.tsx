'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/prize-money';
import { REFRESH_INTERVAL_MS } from '@/lib/config';
import { convertESTtoLocal } from '@/lib/timezone';

interface LiveScore {
  player: string;
  playerId: string;
  position: string;
  positionValue: number | null;
  total: string;
  thru: string;
  currentRoundScore: string;
  roundComplete?: boolean;
  isAmateur?: boolean;
  teeTime?: string; // Tee time from RapidAPI (e.g., "11:35am")
}

interface RosterPlayer {
  playerName: string;
  teeTimeR1?: string | null;
  teeTimeR2?: string | null;
  teeTimeR3?: string | null;
  teeTimeR4?: string | null;
}

interface LivePersonalLeaderboardProps {
  rosterId: string;
  rosterName: string;
  tournamentName: string;
  liveGolfAPITournamentId: string;
  prizeDistributions: Array<{
    position: number;
    amount: number;
  }>;
  displayRound?: number;
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

// Normalize name for matching
const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
};

export function LivePersonalLeaderboard({
  rosterId,
  rosterName,
  tournamentName,
  liveGolfAPITournamentId,
  prizeDistributions,
  displayRound = 1,
}: LivePersonalLeaderboardProps) {
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayer[]>([]);
  const [liveScores, setLiveScores] = useState<LiveScore[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextRefreshIn, setNextRefreshIn] = useState(REFRESH_INTERVAL_MS / 1000);
  const [syncError, setSyncError] = useState<string | null>(null);
  const hasInitialLoaded = useRef(false);

  // Prize distribution map
  const prizeMap = useMemo(
    () => new Map(prizeDistributions.map((d) => [d.position, d.amount])),
    [prizeDistributions]
  );

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
        map.set(`__fuzzy__${lastName}__${firstName}`, score);
      }
    });
    return map;
  }, [liveScores]);

  // Find live score with fuzzy matching for nicknames like "Cam" vs "Cameron"
  const findLiveScore = useCallback((playerName: string): LiveScore | undefined => {
    const normalizedName = normalizeName(playerName);
    
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

  // Calculate winnings for each player based on live scores
  const playersWithLiveData = useMemo(() => {
    return rosterPlayers.map((player) => {
      // Use fuzzy matching to find live score
      const liveScore = findLiveScore(player.playerName);
      
      const position = liveScore?.positionValue;
      const isAmateur = liveScore?.isAmateur === true;
      
      // Calculate winnings with proper tie handling
      // Amateurs cannot collect prize money
      const winnings = isAmateur ? 0 : calculateTiePrizeMoney(position || null);

      return {
        ...player,
        liveScore,
        winnings,
        isAmateur,
      };
    }).sort((a, b) => b.winnings - a.winnings);
  }, [rosterPlayers, findLiveScore, calculateTiePrizeMoney]);

  // Calculate total winnings
  const totalWinnings = useMemo(() => {
    return playersWithLiveData.reduce((sum, p) => sum + p.winnings, 0);
  }, [playersWithLiveData]);

  // Fetch roster players from database
  const fetchRosterPlayers = useCallback(async () => {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('roster_players')
      .select(`
        tournament_player:tournament_players(
          pga_player_id,
          tee_time_r1,
          tee_time_r2,
          tee_time_r3,
          tee_time_r4,
          pga_players(name)
        )
      `)
      .eq('roster_id', rosterId);

    if (error) {
      console.error('Error fetching roster players:', error);
      return;
    }

    const players: RosterPlayer[] = (data || []).map((rp: any) => ({
      playerName: rp.tournament_player?.pga_players?.name || 'Unknown',
      teeTimeR1: rp.tournament_player?.tee_time_r1,
      teeTimeR2: rp.tournament_player?.tee_time_r2,
      teeTimeR3: rp.tournament_player?.tee_time_r3,
      teeTimeR4: rp.tournament_player?.tee_time_r4,
    }));

    setRosterPlayers(players);
  }, [rosterId]);

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
    } catch (error) {
      setSyncError('Network error - unable to refresh scores');
      console.error('[LivePersonalLeaderboard] Error:', error);
    } finally {
      setIsRefreshing(false);
      setNextRefreshIn(REFRESH_INTERVAL_MS / 1000);
    }
  }, [liveGolfAPITournamentId, isRefreshing]);

  // Initial load
  useEffect(() => {
    if (!hasInitialLoaded.current) {
      hasInitialLoaded.current = true;
      fetchRosterPlayers();
      fetchLiveScores();
    }
  }, [fetchRosterPlayers, fetchLiveScores]);

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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex-1">
            <CardTitle className="text-lg sm:text-xl text-casino-text">{rosterName}</CardTitle>
            <p className="text-xs sm:text-sm text-casino-gray mt-1">{tournamentName}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs sm:text-sm text-casino-gray">Total Winnings</p>
            <p className="text-2xl sm:text-3xl font-bold text-casino-green">
              {formatCurrency(totalWinnings)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Live Status Bar */}
        <div className="mb-3 flex items-center gap-2 text-xs text-casino-gray">
          {isRefreshing ? (
            <>
              <span className="animate-spin">🔄</span>
              <span>Updating...</span>
            </>
          ) : syncError ? (
            <span className="text-yellow-500">⚠ Retry in {formatCountdown(nextRefreshIn)}</span>
          ) : (
            <>
              <span className="text-green-500">●</span>
              <span>Live</span>
              <span className="text-casino-gray-dark">•</span>
              <span>Next update: {formatCountdown(nextRefreshIn)}</span>
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-casino-gold/30">
                <th className="px-1 sm:px-3 py-2 text-left text-xs font-medium text-casino-gray uppercase w-6 sm:w-8">#</th>
                <th className="px-1 sm:px-3 py-2 text-left text-xs font-medium text-casino-gray uppercase">Player</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase w-10 sm:w-12">Pos</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase w-12 sm:w-16">Total</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase hidden sm:table-cell w-12 sm:w-16">Today</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase min-w-16 sm:min-w-18">Thru</th>
                <th className="px-2 sm:px-4 py-2 text-right text-xs font-medium text-casino-gray uppercase min-w-18 sm:w-20">Prize</th>
              </tr>
            </thead>
            <tbody>
              {playersWithLiveData.length > 0 ? (
                playersWithLiveData.map((player, index) => (
                  <tr key={index} className="border-b border-casino-gold/10 hover:bg-casino-elevated transition-colors">
                    <td className="px-1 sm:px-3 py-2 text-casino-gray">{index + 1}</td>
                    <td className="px-1 sm:px-3 py-2 text-casino-text">
                      {player.playerName}
                      {player.isAmateur && <span className="text-casino-gray ml-1">(a)</span>}
                    </td>
                    <td className="px-2 sm:px-4 py-2 whitespace-nowrap">
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
                    <td className="px-2 sm:px-4 py-2 whitespace-nowrap">
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
                    <td className="px-2 sm:px-4 py-2 hidden sm:table-cell whitespace-nowrap">
                      {/* If player hasn't started current round, show dash */}
                      {!player.liveScore?.roundComplete && (!player.liveScore?.thru || player.liveScore?.thru === '-' || player.liveScore?.thru === '0') ? (
                        <span className="text-casino-gray-dark">-</span>
                      ) : player.liveScore ? (
                        <span className={
                          parseScore(player.liveScore.currentRoundScore) < 0 ? 'text-casino-green' :
                          parseScore(player.liveScore.currentRoundScore) > 0 ? 'text-casino-red' :
                          'text-casino-gray'
                        }>
                          {player.liveScore.currentRoundScore}
                        </span>
                      ) : (
                        <span className="text-casino-gray-dark">-</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 whitespace-nowrap">
                      {(() => {
                        // Helper to get tee time for current display round
                        const getTeeTimeForRound = () => {
                          if (displayRound === 1) return player.teeTimeR1;
                          if (displayRound === 2) return player.teeTimeR2;
                          if (displayRound === 3) return player.teeTimeR3;
                          if (displayRound === 4) return player.teeTimeR4;
                          return player.teeTimeR1;
                        };
                        const teeTime = getTeeTimeForRound();
                        
                        // Player finished current round - show F or F*
                        if (player.liveScore?.roundComplete || player.liveScore?.thru === 'F' || player.liveScore?.thru === 'F*') {
                          return <span className="text-casino-green font-medium">{player.liveScore?.thru === '18' ? 'F' : player.liveScore?.thru}</span>;
                        }
                        // Player is on course
                        if (player.liveScore?.thru && player.liveScore.thru !== '-' && player.liveScore.thru !== '0') {
                          return <span className="text-casino-blue">{player.liveScore.thru}</span>;
                        }
                        // Player hasn't started - primary: RapidAPI tee time, fallback: DB tee time
                        if (player.liveScore?.teeTime) {
                          return <span className="text-casino-gray">{player.liveScore.teeTime}</span>;
                        }
                        if (teeTime) {
                          return <span className="text-casino-gray">{convertESTtoLocal(teeTime)}</span>;
                        }
                        return <span className="text-casino-gray-dark">-</span>;
                      })()}
                    </td>
                    <td className="px-2 sm:px-4 py-2 text-right whitespace-nowrap">
                      <span className={player.winnings > 0 ? 'text-casino-green font-semibold' : 'text-casino-gray-dark'}>
                        {formatCurrency(player.winnings)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-casino-gray">
                    No players in this roster yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
