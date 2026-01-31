'use client';

import { useEffect, useState, useCallback, useRef, useMemo, Fragment } from 'react';
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
  roundComplete?: boolean; // Whether player finished current round
  is_amateur?: boolean; // Amateurs cannot collect prize money
}

interface TeeTimeData {
  tee_time_r1: string | null;
  tee_time_r2: string | null;
  tee_time_r3: string | null;
  tee_time_r4: string | null;
  starting_tee_r1: number | null;
  starting_tee_r2: number | null;
}

interface CutLineData {
  cutScore: string;
  cutCount: number;
}

interface APIScorecard {
  player: string;
  playerId: string;
  position: string;
  positionValue: number | null;
  total: string;
  thru: string;
  currentRoundScore: string;
  roundComplete?: boolean;
  isAmateur?: boolean;
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
  playerCostMap?: Map<string, number>; // Map of player name to salary cost
  initialCutLine?: CutLineData | null;
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
  
  // Select tee time based on display round
  if (!currentRound || currentRound === 1) {
    estTime = teeTime.tee_time_r1;
  } else if (currentRound === 2) {
    estTime = teeTime.tee_time_r2;
  } else if (currentRound === 3) {
    estTime = teeTime.tee_time_r3;
  } else if (currentRound === 4) {
    estTime = teeTime.tee_time_r4;
  }
  
  // Convert EST to local timezone
  return estTime ? convertESTtoLocal(estTime) : null;
}

export function LiveLeaderboard({
  initialData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tournamentId,
  prizeDistributions,
  userRosterPlayerIds,
  playerNameToIdMap,
  liveGolfAPITournamentId,
  tournamentStatus: initialTournamentStatus,
  currentRound,
  teeTimeMap,
  playerCostMap,
  initialCutLine,
}: LiveLeaderboardProps) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardRow[]>(initialData);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextRefreshIn, setNextRefreshIn] = useState(REFRESH_INTERVAL_MS / 1000);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [apiTournamentStatus, setApiTournamentStatus] = useState<string>('In Progress');
  const [cutLine, setCutLine] = useState<CutLineData | null>(initialCutLine || null);
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

      // Update tournament status
      if (result.tournamentStatus) {
        setApiTournamentStatus(result.tournamentStatus);
      }

      // Transform API data directly to display format
      const scores = result.data;
      
      // First pass: count players at each position to detect ties
      const positionCounts = new Map<number, number>();
      scores.forEach((scorecard: APIScorecard) => {
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
      
      const transformed: LeaderboardRow[] = scores.map((scorecard: APIScorecard) => {
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
        // Amateurs cannot collect prize money
        const isAmateur = scorecard.isAmateur === true;
        const prizeMoney = isAmateur ? 0 : calculateTiePrizeMoney(position, tieCount);

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
          roundComplete: scorecard.roundComplete === true, // Whether player finished current round
          is_amateur: isAmateur,
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
      
      // Update cut line if available
      if (result.cutLine) {
        setCutLine(result.cutLine);
      }
      
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
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-casino-gray">
            <div className="flex items-center gap-2">
              {isCompleted ? (
                <>
                  <span className="text-casino-gold">🏆</span>
                  <span className="text-casino-gold font-medium">Final</span>
                </>
              ) : isRefreshing ? (
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
            {!isCompleted && (
              <button
                onClick={fetchFromAPI}
                disabled={isRefreshing}
                className="text-xs px-2 py-0.5 text-casino-gold hover:text-casino-gold/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRefreshing ? '...' : 'Refresh'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
            <th className="px-1 sm:px-3 py-2 w-10 sm:w-14">Pos</th>
            <th className="px-1 sm:px-3 py-2">Golfer</th>
            <th className="px-1 sm:px-3 py-2 w-12 sm:w-16">Total</th>
            <th className="px-1 sm:px-3 py-2 w-12 sm:w-16" title="Click score to view scorecard">Today</th>
            <th className="px-1 sm:px-3 py-2 w-14 sm:w-16" title="Holes completed or tee time">Thru</th>
            <th className="px-1 sm:px-3 py-2 text-right w-14 sm:w-20">Prize</th>
          </tr>
        </thead>
        <tbody>
          {leaderboardData.map((row, idx) => {
            const name = row.name || 'Unknown';
            const normalizedName = name.toLowerCase().trim()
              .replace(/\s*\([A-Z]{2}\)\s*$/i, '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');

            // Nickname mappings for fuzzy matching
            const nicknameMap: Record<string, string[]> = {
              'cam': ['cameron'],
              'cameron': ['cam'],
              'dan': ['daniel'],
              'daniel': ['dan'],
              'john': ['johnny', 'jon'],
              'johnny': ['john', 'jon'],
              'jon': ['john', 'johnny'],
              'mike': ['michael'],
              'michael': ['mike'],
              'matt': ['matthew', 'matthias', 'matti'],
              'matthew': ['matt'],
              'matthias': ['matt', 'matti'],
              'matti': ['matt', 'matthias'],
              'bob': ['robert'],
              'robert': ['bob'],
              'bill': ['william', 'billy'],
              'billy': ['william', 'bill'],
              'william': ['bill', 'billy'],
              'nick': ['nicholas'],
              'nicholas': ['nick'],
              'alex': ['alexander'],
              'alexander': ['alex'],
              'chris': ['christopher'],
              'christopher': ['chris'],
              'jim': ['james'],
              'james': ['jim'],
              's.t.': ['seung taek'],
            };

            // Try exact match first
            let playerId = playerNameToIdMap.get(normalizedName) || playerNameToIdMap.get(name.toLowerCase().trim());
            let matchedMapName = normalizedName; // Track which name matched for cost lookup
            
            // If no match, try fuzzy matching (e.g., "Cam Davis" vs "Cameron Davis")
            if (!playerId) {
              const nameParts = normalizedName.split(' ');
              if (nameParts.length >= 2) {
                const apiLastName = nameParts[nameParts.length - 1];
                const apiFirstName = nameParts[0];
                
                // Search through all player names in the map
                for (const [mapName, mapId] of playerNameToIdMap.entries()) {
                  const mapParts = mapName.split(' ');
                  if (mapParts.length >= 2) {
                    const mapLastName = mapParts[mapParts.length - 1];
                    const mapFirstName = mapParts[0];
                    
                    // Match if last names match
                    if (apiLastName === mapLastName) {
                      // Check if first names match via prefix
                      if (apiFirstName.startsWith(mapFirstName) || mapFirstName.startsWith(apiFirstName)) {
                        playerId = mapId;
                        matchedMapName = mapName;
                        break;
                      }
                      // Check nickname mappings
                      const apiNicknames = nicknameMap[apiFirstName] || [];
                      const mapNicknames = nicknameMap[mapFirstName] || [];
                      if (apiNicknames.includes(mapFirstName) || mapNicknames.includes(apiFirstName)) {
                        playerId = mapId;
                        matchedMapName = mapName;
                        break;
                      }
                    }
                  }
                }
              }
            }
            
            const isUserPlayer = playerId && userRosterPlayerIds.includes(playerId);
            const playerCost = playerCostMap?.get(matchedMapName);

            const pos = row.position
              ? `${row.is_tied ? 'T' : ''}${row.position}`
              : 'CUT';
            const totalClass = getScoreColor(row.total_score);
            const todayClass = getScoreColor(row.today_score);

            // Use prize_money from row, or look up from prize distribution
            // Amateurs cannot collect prize money
            // If player's score is worse than the cut score, show $0
            // cutScore is like "-3", so we need to parse and compare
            const cutScoreNum = cutLine ? parseScore(cutLine.cutScore) : null;
            const isBelowProjectedCut = cutLine && row.position !== null && cutScoreNum !== null && row.total_score > cutScoreNum;
            const prizeAmount = (row.is_amateur || isBelowProjectedCut) ? 0 : (
              row.prize_money ||
              (row.position ? prizeDistributionMap.get(row.position) : 0) ||
              0
            );

            const prevRow = idx > 0 ? leaderboardData[idx - 1] : null;
            
            // Check if this is where the cut line should be shown
            // Show line between the last player at cutScore and first player worse than cutScore
            const prevRowScore = prevRow ? prevRow.total_score : null;
            const isProjectedCutPosition = cutLine && 
              row.position !== null && 
              cutScoreNum !== null &&
              prevRowScore !== null &&
              prevRowScore <= cutScoreNum && // Previous player is at or better than cut
              row.total_score > cutScoreNum;  // This player is worse than cut

            return (
              <Fragment key={`${row.position}-${name}-${idx}`}>
                {/* Cut Line Bar - projected during R1/R2, official after R3+ */}
                {isProjectedCutPosition && (
                  <tr className="bg-yellow-900/20 border-y-2 border-yellow-500/40">
                    <td colSpan={6} className="px-3 py-2 text-center">
                      <span className="text-yellow-400 font-semibold text-sm">
                        {(currentRound || 1) >= 3 ? 'CUT LINE' : 'PROJECTED CUT'}: {cutLine.cutScore} ({typeof cutLine.cutCount === 'object' && cutLine.cutCount !== null && '$numberInt' in cutLine.cutCount ? (cutLine.cutCount as unknown as {$numberInt: string}).$numberInt : cutLine.cutCount} players made the cut)
                      </span>
                    </td>
                  </tr>
                )}
              <tr
                className={`border-b transition-colors ${
                  isUserPlayer
                    ? 'bg-casino-gold/20 border-casino-gold/40 hover:bg-casino-gold/30'
                    : 'border-casino-gold/10 hover:bg-casino-elevated'
                }`}
              >
                <td className="px-1 sm:px-3 py-2 font-medium text-casino-text text-xs sm:text-sm">
                  {pos}
                </td>
                <td className={`px-1 sm:px-3 py-2 text-xs sm:text-sm ${isUserPlayer ? 'font-bold text-casino-gold' : 'text-casino-text'}`}>
                  {name}
                  {row.is_amateur && <span className="text-casino-gray font-normal ml-1">(a)</span>}
                  {playerCost !== undefined && (
                    <span className="text-casino-gray font-normal ml-1">(${playerCost})</span>
                  )}
                </td>
                <td className={`px-1 sm:px-3 py-2 font-semibold text-xs sm:text-sm ${totalClass}`}>
                  {formatScore(row.total_score)}
                </td>
                <td className={`px-1 sm:px-3 py-2 text-xs sm:text-sm ${!row.roundComplete && (row.thru === '-' || row.thru === '0' || row.thru === 0 || !row.thru) ? 'text-casino-gray-dark' : todayClass}`}>
                  {/* If player hasn't started current round, show dash */}
                  {!row.roundComplete && (row.thru === '-' || row.thru === '0' || row.thru === 0 || !row.thru) ? (
                    <span>-</span>
                  ) : row.apiPlayerId ? (
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
                <td className="px-1 sm:px-3 py-2 text-xs sm:text-sm">
                  {/* If player missed the cut or was DQ'd, show dash */}
                  {!row.position ? (
                    <span className="text-casino-gray-dark">-</span>
                  ) : row.roundComplete || row.thru === 'F' || row.thru === 'F*' || row.thru === 18 || row.thru === '18' ? (
                    /* Player finished current round - show F or F* */
                    <span className="text-casino-green font-medium">{row.thru === 18 || row.thru === '18' ? 'F' : row.thru}</span>
                  ) : row.thru && row.thru !== '-' && row.thru !== '0' && row.thru !== 0 ? (
                    /* Player is on course - show holes completed */
                    <span className="text-casino-blue">{row.thru}</span>
                  ) : getTeeTimeForRound(teeTimeMap?.get(row.name), currentRound) ? (
                    /* Player hasn't started - show tee time */
                    <span className="text-casino-gray">{getTeeTimeForRound(teeTimeMap?.get(row.name), currentRound)}</span>
                  ) : (
                    <span className="text-casino-gray-dark">-</span>
                  )}
                </td>
                <td className="px-1 sm:px-3 py-2 text-right text-xs sm:text-sm text-casino-gold">
                  {formatCurrency(prizeAmount || 0)}
                </td>
              </tr>
              </Fragment>
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