'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { formatScore, getScoreColor } from '@/lib/utils';
import { formatCurrency } from '@/lib/prize-money';
import { REFRESH_INTERVAL_MS } from '@/lib/config';
import { ScorecardModal } from './ScorecardModal';
import { convertESTtoLocal } from '@/lib/timezone';

interface LeaderboardRow {
  position: number | null;
  is_tied: boolean;
  tied_with_count: number;
  total_score: number;
  today_score: number;
  thru: string | number;
  prize_money: number;
  name: string;
  apiPlayerId?: string; // Player ID from RapidAPI for scorecard lookup
}

interface TeeTimeData {
  tee_time_r1: string | null;
  tee_time_r2: string | null;
  starting_tee_r1: number | null;
  starting_tee_r2: number | null;
}

interface LiveLeaderboardProps {
  initialData: LeaderboardRow[];
  tournamentId: string;
  prizeDistributions: Array<{
    position: number;
    percentage: number | null;
    amount: number;
    total_purse: number;
  }>;
  userRosterPlayerIds: string[];
  playerNameToIdMap: Map<string, string>;
  liveGolfAPITournamentId?: string;
  tournamentStatus?: 'upcoming' | 'active' | 'completed';
  currentRound?: number;
  teeTimeMap?: Map<string, TeeTimeData>; // Map of player name to tee time data
}

// Helper to parse scores from API
const parseScore = (score: string | number | null): number => {
  if (score === null || score === undefined) return 0;
  if (typeof score === 'number') return score;
  if (score === 'E') return 0;
  const s = score.toString().trim();
  if (s.startsWith('+')) return parseInt(s.slice(1), 10) || 0;
  if (s.startsWith('-')) return -parseInt(s.slice(1), 10) || 0;
  return parseInt(s, 10) || 0;
};

/**
 * Get the tee time to display based on the current round
 * Converts from EST to user's local timezone
 */
function getTeeTimeForRound(teeTime: TeeTimeData | undefined, currentRound?: number): string | null {
  if (!teeTime) return null;
  
  let estTime: string | null = null;
  
  // For round 1 or before tournament starts, show R1 tee time
  if (!currentRound || currentRound === 1) {
    estTime = teeTime.tee_time_r1;
  }
  // For round 2, show R2 tee time
  else if (currentRound === 2) {
    estTime = teeTime.tee_time_r2;
  }
  
  // Convert EST to local timezone
  return estTime ? convertESTtoLocal(estTime) : null;
}

export function LiveLeaderboard({
  initialData,
  tournamentId,
  prizeDistributions,
  userRosterPlayerIds,
  playerNameToIdMap,
  liveGolfAPITournamentId,
  tournamentStatus: initialTournamentStatus,
  currentRound,
  teeTimeMap,
}: LiveLeaderboardProps) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardRow[]>(initialData);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextRefreshIn, setNextRefreshIn] = useState(REFRESH_INTERVAL_MS / 1000);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [apiTournamentStatus, setApiTournamentStatus] = useState<string>('In Progress');
  const [cacheAge, setCacheAge] = useState<number | null>(null); // How old the server cache is
  const hasInitialSynced = useRef(false);
  
  // Scorecard modal state
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);

  // Check if tournament is completed - use passed prop first, then API status
  const isCompleted = initialTournamentStatus === 'completed' || apiTournamentStatus === 'Official';

  // Create prize distribution map (memoized)
  const prizeDistributionMap = useMemo(() => 
    new Map(prizeDistributions.map((dist) => [dist.position, dist.amount])),
    [prizeDistributions]
  );

  // Function to fetch directly from API and transform
  const fetchFromAPI = useCallback(async () => {
    if (!liveGolfAPITournamentId || isRefreshing) return;
    
    // Don't fetch if tournament is already completed
    if (isCompleted) {
      console.log('[LiveLeaderboard] Tournament completed, skipping fetch');
      return;
    }

    setIsRefreshing(true);
    setSyncError(null);

    try {
      // Fetch directly from our API route that calls LiveGolfAPI
      const response = await fetch(`/api/scores/live?eventId=${liveGolfAPITournamentId}`);
      const result = await response.json();

      if (!response.ok || !result.data) {
        const errorMsg = result.error || 'Failed to fetch scores';
        if (errorMsg.includes('502') || errorMsg.includes('unavailable')) {
          setSyncError('LiveGolfAPI is currently unavailable. Showing cached data.');
        } else {
          setSyncError(errorMsg);
        }
        return;
      }

      // Update tournament status and cache age
      if (result.tournamentStatus) {
        setApiTournamentStatus(result.tournamentStatus);
      }
      if (result.cacheAge !== undefined) {
        setCacheAge(result.cacheAge);
      }

      // Transform API data directly to display format
      const scores = result.data;
      
      // First pass: count players at each position to detect ties
      const positionCounts = new Map<number, number>();
      scores.forEach((scorecard: any) => {
        const position = scorecard.positionValue || 
          (scorecard.position ? parseInt(scorecard.position.replace('T', '')) : null);
        if (position && position > 0) {
          positionCounts.set(position, (positionCounts.get(position) || 0) + 1);
        }
      });
      
      // Helper to calculate prize money with proper tie handling
      const calculateTiePrizeMoney = (position: number | null, tieCount: number): number => {
        if (!position || position < 1 || tieCount < 1) return 0;
        
        // Sum prize money for positions position through position + tieCount - 1
        let totalPrize = 0;
        for (let i = 0; i < tieCount; i++) {
          const pos = position + i;
          totalPrize += prizeDistributionMap.get(pos) || 0;
        }
        
        // Split evenly among tied players
        return Math.round(totalPrize / tieCount);
      };
      
      const transformed: LeaderboardRow[] = scores.map((scorecard: any) => {
        // Handle both RapidAPI and LiveGolfAPI formats
        const position = scorecard.positionValue || 
          (scorecard.position ? parseInt(scorecard.position.replace('T', '')) : null);
        const tieCount = position ? (positionCounts.get(position) || 1) : 1;
        const isTied = tieCount > 1;
        
        // Get today's score - RapidAPI provides currentRoundScore directly
        const todayScore = scorecard.currentRoundScore 
          ? parseScore(scorecard.currentRoundScore)
          : parseScore(scorecard.total);
        
        // Calculate prize money with proper tie handling
        const prizeMoney = calculateTiePrizeMoney(position, tieCount);

        return {
          position,
          is_tied: isTied,
          tied_with_count: tieCount,
          total_score: parseScore(scorecard.total),
          today_score: todayScore,
          thru: scorecard.thru || '-',
          prize_money: prizeMoney,
          name: scorecard.player || 'Unknown',
          apiPlayerId: scorecard.playerId, // Store API player ID for scorecard lookup
        };
      });

      // Sort by position
      transformed.sort((a, b) => {
        if (a.position === null) return 1;
        if (b.position === null) return -1;
        return a.position - b.position;
      });

      setLeaderboardData(transformed);
      setLastRefresh(new Date());
      setSyncError(null);
      console.log('[LiveLeaderboard] Refreshed directly from API at', new Date().toLocaleTimeString());

    } catch (error) {
      setSyncError('Network error - unable to refresh scores');
      console.error('[LiveLeaderboard] Error fetching from API:', error);
    } finally {
      setIsRefreshing(false);
      setNextRefreshIn(REFRESH_INTERVAL_MS / 1000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveGolfAPITournamentId, prizeDistributionMap, isCompleted]);

  // Trigger initial fetch on mount - but skip for completed tournaments
  // Server already provides final data, no need to re-fetch
  useEffect(() => {
    if (liveGolfAPITournamentId && !hasInitialSynced.current && !isCompleted) {
      hasInitialSynced.current = true;
      // Small delay to prevent flash on initial render
      const timer = setTimeout(() => {
        console.log('[LiveLeaderboard] Fetching initial data from API...');
        fetchFromAPI();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [liveGolfAPITournamentId, fetchFromAPI, isCompleted]);

  useEffect(() => {
    // Don't poll if tournament is completed
    if (isCompleted) {
      console.log('[LiveLeaderboard] Tournament completed, stopping polling');
      return;
    }

    // Set up polling interval
    const pollInterval = setInterval(() => {
      fetchFromAPI();
    }, REFRESH_INTERVAL_MS);

    // Countdown timer for next refresh
    const countdownInterval = setInterval(() => {
      setNextRefreshIn((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(countdownInterval);
    };
  }, [fetchFromAPI, isCompleted]);

  // Format countdown
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      {/* Refresh Status Bar */}
      {liveGolfAPITournamentId && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between p-2 bg-casino-elevated rounded-lg border border-casino-gold/20">
            <div className="flex items-center gap-2 text-xs text-casino-gray">
              {isCompleted ? (
                <>
                  <span className="text-casino-gold">🏆</span>
                  <span className="text-casino-gold font-medium">Tournament Completed</span>
                </>
              ) : isRefreshing ? (
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
                  {cacheAge !== null && (
                    <>
                      <span className="text-casino-gray-dark">|</span>
                      <span>Data {cacheAge < 60 ? `${cacheAge}s` : `${Math.floor(cacheAge / 60)}m`} old</span>
                    </>
                  )}
                  <span className="text-casino-gray-dark">|</span>
                  <span>Next check in {formatCountdown(nextRefreshIn)}</span>
                </>
              )}
            </div>
            {!isCompleted && (
              <button
                onClick={fetchFromAPI}
                disabled={isRefreshing}
                className="text-xs px-3 py-1 bg-casino-gold/20 hover:bg-casino-gold/30 text-casino-gold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
              </button>
            )}
          </div>
          {syncError && (
            <div className="p-2 bg-yellow-900/30 border border-yellow-600/50 rounded-lg text-xs text-yellow-300">
              ⚠️ {syncError}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
            <th className="px-2 sm:px-4 py-2">Pos</th>
            <th className="px-2 sm:px-4 py-2">Golfer</th>
            <th className="px-2 sm:px-4 py-2">Total</th>
            <th className="px-2 sm:px-4 py-2" title="Click score to view scorecard">Today</th>
            <th className="px-2 sm:px-4 py-2 hidden sm:table-cell" title="Holes completed or tee time">Thru</th>
            <th className="px-2 sm:px-4 py-2 text-right">Prize</th>
          </tr>
        </thead>
        <tbody>
          {leaderboardData.map((row, idx) => {
            const name = row.name || 'Unknown';
            const normalizedName = name.toLowerCase().trim()
              .replace(/\s*\([A-Z]{2}\)\s*$/i, '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');

            const playerId = playerNameToIdMap.get(normalizedName) || playerNameToIdMap.get(name.toLowerCase().trim());
            const isUserPlayer = playerId && userRosterPlayerIds.includes(playerId);

            const pos = row.position
              ? `${row.is_tied ? 'T' : ''}${row.position}`
              : 'CUT';
            const totalClass = getScoreColor(row.total_score);
            const todayClass = getScoreColor(row.today_score);

            // Use prize_money from row, or look up from prize distribution
            const prizeAmount = row.prize_money ||
              (row.position ? prizeDistributionMap.get(row.position) : 0) ||
              0;

            return (
              <tr
                key={`${row.position}-${name}-${idx}`}
                className={`border-b transition-colors ${
                  isUserPlayer
                    ? 'bg-casino-gold/20 border-casino-gold/40 hover:bg-casino-gold/30'
                    : 'border-casino-gold/10 hover:bg-casino-elevated'
                }`}
              >
                <td className="px-2 sm:px-4 py-2 font-medium text-casino-text text-xs sm:text-sm">
                  {isUserPlayer && <span className="mr-1">⭐</span>}
                  {pos}
                </td>
                <td className={`px-2 sm:px-4 py-2 text-xs sm:text-sm ${isUserPlayer ? 'font-bold text-casino-gold' : 'text-casino-text'}`}>
                  {name}
                </td>
                <td className={`px-2 sm:px-4 py-2 font-semibold text-xs sm:text-sm ${totalClass}`}>
                  {formatScore(row.total_score)}
                </td>
                <td className={`px-2 sm:px-4 py-2 text-xs sm:text-sm ${todayClass}`}>
                  {row.apiPlayerId ? (
                    <button
                      onClick={() => setSelectedPlayer({ id: row.apiPlayerId!, name: row.name })}
                      className="hover:underline hover:text-casino-gold transition-colors cursor-pointer"
                      title="Click to view scorecard"
                    >
                      {formatScore(row.today_score)}
                    </button>
                  ) : (
                    formatScore(row.today_score)
                  )}
                </td>
                <td className="px-2 sm:px-4 py-2 text-casino-gray text-xs sm:text-sm hidden sm:table-cell">
                  {row.thru && row.thru !== '-' && row.thru !== '0' 
                    ? row.thru 
                    : getTeeTimeForRound(teeTimeMap?.get(row.name), currentRound) || '-'}
                </td>
                <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm text-casino-gold">
                  {formatCurrency(prizeAmount || 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {/* Scorecard Modal */}
      {liveGolfAPITournamentId && (
        <ScorecardModal
          isOpen={selectedPlayer !== null}
          onClose={() => setSelectedPlayer(null)}
          playerId={selectedPlayer?.id || ''}
          playerName={selectedPlayer?.name || ''}
          eventId={liveGolfAPITournamentId}
        />
      )}
    </div>
  );
}