'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/prize-money';
import { REFRESH_INTERVAL_MS } from '@/lib/config';
import {
  processLiveScoresForPrizes,
  normalizeNameForLookup,
  firstNamesMatchForLiveScores,
} from '@/lib/live-scores-prizes';
import { formatTeeTimeDisplay } from '@/lib/timezone';
import { formatShortName } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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
  liveGolfAPITournamentId?: string;
  espnEventId?: string | null;
  scorecardSource?: 'espn' | 'rapidapi';
  prizeDistributions: Array<{
    position: number;
    amount: number;
  }>;
  displayRound?: number;
}

// Type for roster_players query result (Supabase join)
interface RosterPlayerRow {
  tournament_player: {
    pga_player_id?: string;
    tee_time_r1?: string | null;
    tee_time_r2?: string | null;
    tee_time_r3?: string | null;
    tee_time_r4?: string | null;
    pga_players?: { name?: string } | null;
  } | null;
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
  espnEventId,
  scorecardSource = 'rapidapi',
  prizeDistributions,
  displayRound = 1,
}: LivePersonalLeaderboardProps) {
  const liveUrl = scorecardSource === 'espn' && espnEventId
    ? `/api/scores/live?source=espn&eventId=${encodeURIComponent(espnEventId)}`
    : liveGolfAPITournamentId
      ? `/api/scores/live?eventId=${liveGolfAPITournamentId}`
      : null;
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayer[]>([]);
  const [liveScores, setLiveScores] = useState<LiveScore[]>([]);
  const [liveSource, setLiveSource] = useState<'espn' | 'rapidapi'>('rapidapi');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextRefreshIn, setNextRefreshIn] = useState(REFRESH_INTERVAL_MS / 1000);
  const [syncError, setSyncError] = useState<string | null>(null);
  const hasInitialLoaded = useRef(false);
  const isMobile = useMediaQuery('(max-width: 639px)');

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
          if (fuzzyLastName === lastName && firstNamesMatchForLiveScores(firstName, fuzzyFirstName)) {
            return score;
          }
        }
      }
    }
    
    return undefined;
  }, [playerScoreMap]);

  // Shared prize logic: position-from-score (ESPN), tie split, exclude non-teed-off
  const prizeDataByPlayer = useMemo(() => {
    if (!liveScores.length) return new Map<string, { winnings: number; hasTeedOff: boolean; positionDisplay: string }>();
    const processed = processLiveScoresForPrizes(
      liveScores,
      liveSource,
      prizeMap
    );
    const byPlayer = new Map<string, { winnings: number; hasTeedOff: boolean; positionDisplay: string }>();
    processed.forEach((data, key) => {
      byPlayer.set(key, {
        winnings: data.winnings,
        hasTeedOff: data.hasTeedOff,
        positionDisplay: data.positionDisplay,
      });
    });
    return byPlayer;
  }, [liveScores, liveSource, prizeMap]);

  // Calculate winnings for each player based on live scores (uses shared prize logic)
  const playersWithLiveData = useMemo(() => {
    return rosterPlayers.map((player) => {
      const liveScore = findLiveScore(player.playerName);
      const lookupKey = liveScore ? normalizeNameForLookup(liveScore.player) : null;
      const prizeData = lookupKey ? prizeDataByPlayer.get(lookupKey) : null;
      const winnings = prizeData?.winnings ?? 0;
      const hasTeedOff = prizeData?.hasTeedOff ?? false;
      const positionDisplay = prizeData?.positionDisplay ?? '';

      return {
        ...player,
        liveScore,
        winnings,
        isAmateur: liveScore?.isAmateur === true,
        hasTeedOff,
        positionDisplay,
      };
    }).sort((a, b) => b.winnings - a.winnings);
  }, [rosterPlayers, findLiveScore, prizeDataByPlayer]);

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

    const rows = (data || []) as unknown as RosterPlayerRow[];
    const players: RosterPlayer[] = rows.map((rp) => ({
      playerName: rp.tournament_player?.pga_players?.name || 'Unknown',
      teeTimeR1: rp.tournament_player?.tee_time_r1,
      teeTimeR2: rp.tournament_player?.tee_time_r2,
      teeTimeR3: rp.tournament_player?.tee_time_r3,
      teeTimeR4: rp.tournament_player?.tee_time_r4,
    }));

    setRosterPlayers(players);
  }, [rosterId]);

  // Fetch live scores from API (ESPN or RapidAPI based on scorecardSource)
  const fetchLiveScores = useCallback(async () => {
    if (!liveUrl || isRefreshing) return;

    setIsRefreshing(true);
    setSyncError(null);

    try {
      const response = await fetch(liveUrl);
      const result = await response.json();

      if (!response.ok || !result.data) {
        setSyncError(result.error || 'Failed to fetch scores');
        return;
      }

      setLiveScores(result.data);
      setLiveSource(result.source === 'espn' ? 'espn' : 'rapidapi');
    } catch (error) {
      setSyncError('Network error - unable to refresh scores');
      console.error('[LivePersonalLeaderboard] Error:', error);
    } finally {
      setIsRefreshing(false);
      setNextRefreshIn(REFRESH_INTERVAL_MS / 1000);
    }
  }, [liveUrl, isRefreshing]);

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
        <div className="flex flex-row items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg sm:text-xl text-casino-text truncate">{rosterName}</CardTitle>
            <p className="text-xs sm:text-sm text-casino-gray mt-1 truncate">{tournamentName}</p>
          </div>
          <div className="shrink-0 text-right">
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
          <table className={`w-full text-sm ${isMobile ? 'table-fixed' : ''}`}>
            {isMobile && (
              <colgroup>
                <col style={{ width: '30px' }} />
                <col />
                <col style={{ width: '42px' }} />
                <col style={{ width: '42px' }} />
                <col style={{ width: '42px' }} />
                <col style={{ width: '82px' }} />
              </colgroup>
            )}
            <thead>
              <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
                <th className="px-0.5 sm:px-3 py-2">Pos</th>
                <th className="px-0.5 sm:px-3 py-2">Golfer</th>
                <th className="px-0.5 sm:px-4 py-2 text-center">Total</th>
                <th className="px-0.5 sm:px-4 py-2 text-center">Today</th>
                <th className="px-0.5 sm:px-4 py-2 text-center">Thru</th>
                <th className="px-0.5 sm:px-4 py-2 text-right">Prize</th>
              </tr>
            </thead>
            <tbody>
              {playersWithLiveData.length > 0 ? (
                playersWithLiveData.map((player, index) => (
                  <tr key={index} className="border-b border-casino-gold/10 hover:bg-casino-elevated transition-colors">
                    <td className="px-0.5 sm:px-3 py-2 font-medium text-casino-text text-xs sm:text-sm whitespace-nowrap">
                      {player.positionDisplay ? (
                        <span className={`font-medium ${
                          player.positionDisplay === '1' || player.positionDisplay === 'T1' ? 'text-casino-gold' :
                          parseInt(player.positionDisplay.replace('T', '')) <= 10 ? 'text-casino-green' :
                          'text-casino-text'
                        }`}>
                          {player.positionDisplay}
                        </span>
                      ) : (
                        <span className="text-casino-gray-dark">{player.liveScore ? '' : '-'}</span>
                      )}
                    </td>
                    <td className="px-0.5 sm:px-3 py-2 text-xs sm:text-sm text-casino-text">
                      <span className="truncate block">
                        {isMobile ? formatShortName(player.playerName) : player.playerName}
                        {player.isAmateur && <span className="text-casino-gray font-normal ml-1">(a)</span>}
                      </span>
                    </td>
                    <td className={`px-0.5 sm:px-4 py-2 font-semibold text-xs sm:text-sm whitespace-nowrap text-center ${
                      player.liveScore
                        ? parseScore(player.liveScore.total) < 0 ? 'text-casino-green' :
                          parseScore(player.liveScore.total) > 0 ? 'text-casino-red' : 'text-casino-gray'
                        : ''
                    }`}>
                      {player.liveScore ? (
                        player.liveScore.total
                      ) : (
                        <span className="text-casino-gray-dark">-</span>
                      )}
                    </td>
                    <td className={`px-0.5 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap text-center ${
                      !player.liveScore?.roundComplete && (!player.liveScore?.thru || player.liveScore?.thru === '-' || player.liveScore?.thru === '0')
                        ? 'text-casino-gray-dark'
                        : player.liveScore
                          ? parseScore(player.liveScore.currentRoundScore) < 0 ? 'text-casino-green' :
                            parseScore(player.liveScore.currentRoundScore) > 0 ? 'text-casino-red' : 'text-casino-gray'
                          : 'text-casino-gray-dark'
                    }`}>
                      {/* If player hasn't started current round, show dash */}
                      {!player.liveScore?.roundComplete && (!player.liveScore?.thru || player.liveScore?.thru === '-' || player.liveScore?.thru === '0') ? (
                        <span>-</span>
                      ) : player.liveScore ? (
                        player.liveScore.currentRoundScore
                      ) : (
                        <span className="text-casino-gray-dark">-</span>
                      )}
                    </td>
                    <td className="px-0.5 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap text-center">
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
                        // Player hasn't started - primary: cache tee time (EST), fallback: DB tee time
                        if (player.liveScore?.teeTime) {
                          return <span className="text-casino-gray">{formatTeeTimeDisplay(player.liveScore.teeTime)}</span>;
                        }
                        if (teeTime) {
                          return <span className="text-casino-gray">{formatTeeTimeDisplay(teeTime)}</span>;
                        }
                        return <span className="text-casino-gray-dark">-</span>;
                      })()}
                    </td>
                    <td className="px-0.5 sm:px-4 py-2 text-right text-xs sm:text-sm whitespace-nowrap tabular-nums">
                      <span className={player.winnings > 0 ? 'text-casino-gold' : 'text-casino-gray-dark'}>
                        {formatCurrency(player.winnings)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-casino-gray">
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
