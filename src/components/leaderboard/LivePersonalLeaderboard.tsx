'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/prize-money';
import { REFRESH_INTERVAL_MS } from '@/lib/config';

interface LiveScore {
  player: string;
  playerId: string;
  position: string;
  positionValue: number | null;
  total: string;
  thru: string;
  currentRoundScore: string;
}

interface RosterPlayer {
  playerName: string;
  imageUrl?: string;
  country?: string;
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

  // Create a map of player name -> live score data
  const playerScoreMap = useMemo(() => {
    const map = new Map<string, LiveScore>();
    liveScores.forEach((score) => {
      const normalizedName = normalizeName(score.player);
      map.set(normalizedName, score);
    });
    return map;
  }, [liveScores]);

  // Calculate winnings for each player based on live scores
  const playersWithLiveData = useMemo(() => {
    return rosterPlayers.map((player) => {
      const normalizedName = normalizeName(player.playerName);
      const liveScore = playerScoreMap.get(normalizedName);
      
      let winnings = 0;
      const position = liveScore?.positionValue;
      
      if (position && position > 0) {
        const prize = prizeMap.get(position);
        if (prize) {
          winnings = prize;
        }
      }

      return {
        ...player,
        liveScore,
        winnings,
      };
    }).sort((a, b) => b.winnings - a.winnings);
  }, [rosterPlayers, playerScoreMap, prizeMap]);

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
          pga_players(name, image_url, country)
        )
      `)
      .eq('roster_id', rosterId);

    if (error) {
      console.error('Error fetching roster players:', error);
      return;
    }

    const players: RosterPlayer[] = (data || []).map((rp: any) => ({
      playerName: rp.tournament_player?.pga_players?.name || 'Unknown',
      imageUrl: rp.tournament_player?.pga_players?.image_url,
      country: rp.tournament_player?.pga_players?.country,
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
        {/* Refresh Status Bar */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between p-2 bg-casino-elevated rounded-lg border border-casino-gold/20">
            <div className="flex items-center gap-2 text-xs text-casino-gray">
              {isRefreshing ? (
                <>
                  <span className="animate-spin">🔄</span>
                  <span>Refreshing...</span>
                </>
              ) : syncError ? (
                <>
                  <span className="text-yellow-500">⚠</span>
                  <span>Retry in {formatCountdown(nextRefreshIn)}</span>
                </>
              ) : (
                <>
                  <span className="text-green-500">●</span>
                  <span>Live</span>
                  <span className="text-casino-gray-dark">|</span>
                  <span>Next: {formatCountdown(nextRefreshIn)}</span>
                </>
              )}
            </div>
            <button
              onClick={fetchLiveScores}
              disabled={isRefreshing}
              className="text-xs px-3 py-1 bg-casino-gold/20 hover:bg-casino-gold/30 text-casino-gold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          {syncError && (
            <div className="p-2 bg-yellow-900/30 border border-yellow-600/50 rounded-lg text-xs text-yellow-300">
              ⚠️ {syncError}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-casino-gold/30">
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase">#</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase">Player</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase">Pos</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase">Total</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase hidden sm:table-cell">Today</th>
                <th className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-casino-gray uppercase hidden md:table-cell">Thru</th>
                <th className="px-2 sm:px-4 py-2 text-right text-xs font-medium text-casino-gray uppercase">Prize</th>
              </tr>
            </thead>
            <tbody>
              {playersWithLiveData.length > 0 ? (
                playersWithLiveData.map((player, index) => (
                  <tr key={index} className="border-b border-casino-gold/10 hover:bg-casino-elevated transition-colors">
                    <td className="px-2 sm:px-4 py-2 text-casino-gray">{index + 1}</td>
                    <td className="px-2 sm:px-4 py-2">
                      <div className="flex items-center gap-2">
                        {player.imageUrl ? (
                          <img
                            src={player.imageUrl}
                            alt={player.playerName}
                            className="w-6 h-6 rounded-full object-cover border border-casino-gold/20"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-casino-card border border-casino-gold/20 flex items-center justify-center text-xs">
                            <span className="text-casino-gray">{player.playerName.charAt(0)}</span>
                          </div>
                        )}
                        <span className="text-casino-text">{player.playerName}</span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-2">
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
                    <td className="px-2 sm:px-4 py-2">
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
                    <td className="px-2 sm:px-4 py-2 hidden sm:table-cell">
                      {player.liveScore ? (
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
                    <td className="px-2 sm:px-4 py-2 hidden md:table-cell">
                      {player.liveScore?.thru === 'F' ? (
                        <span className="text-casino-green font-medium">F</span>
                      ) : player.liveScore?.thru ? (
                        <span className="text-casino-blue">{player.liveScore.thru}</span>
                      ) : (
                        <span className="text-casino-gray-dark">-</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 text-right">
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
