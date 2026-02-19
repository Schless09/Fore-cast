'use client';

import { useEffect, useState, useCallback, useRef, useMemo, Fragment } from 'react';
import { formatScore, getScoreColor, formatShortName } from '@/lib/utils';
import { formatTeeTimeDisplay } from '@/lib/timezone';
import { formatCurrency } from '@/lib/prize-money';
import { REFRESH_INTERVAL_MS } from '@/lib/config';
import { assignPositionsByScore } from '@/lib/leaderboard-positions';
import { ScorecardModal } from './ScorecardModal';
import { SuspendedStatusBanner } from './SuspendedStatusBanner';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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
  teeTime?: string; // Tee time from RapidAPI (e.g., "11:35am")
  hasTeedOff?: boolean; // false when THRU shows tee time, haven't started yet
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
  teeTime?: string; // Tee time from RapidAPI (e.g., "11:35am")
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
  espnEventId?: string | null;
  scorecardSource?: 'espn' | 'rapidapi';
  tournamentStatus?: 'upcoming' | 'active' | 'completed';
  currentRound?: number;
  teeTimeMap?: Map<string, TeeTimeData>;
  playerCostMap?: Map<string, number>;
  initialCutLine?: CutLineData | null;
  /** Number of league teams that picked each golfer (by player name). Used for Picks column. */
  picksByPlayer?: Record<string, number>;
}

/** Player has teed off if thru shows holes played (1, 2, F) not a tee time (1:39 PM) */
const hasTeedOff = (thru: string | number | undefined): boolean => {
  if (thru === undefined || thru === null) return false;
  const s = String(thru).trim();
  if (s === '-' || s === '' || s === '0') return false;
  if (s === 'F' || s === '18') return true;
  if (s.includes(':') || s.includes('AM') || s.includes('PM')) return false; // tee time
  const n = parseInt(s.replace('*', ''), 10);
  return !Number.isNaN(n) && n > 0;
};

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
  
  // Return raw EST string; caller uses LocalTeeTime for client-side conversion
  return estTime ?? null;
}

// Normalize name for matching: trim, lowercase, strip accents, replace ø/ö/å etc. with ASCII
function normalizeNameForTeeTime(name: string): string {
  let s = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // remove combining marks (accents)
    .replace(/\s+/g, ' ');
  // Replace non-ASCII Latin chars that NFD doesn't decompose (e.g. ø, ö, å)
  s = s.replace(/ø/g, 'o').replace(/ö/g, 'o').replace(/å/g, 'a').replace(/ä/g, 'a').replace(/æ/g, 'ae').replace(/ß/g, 'ss');
  return s;
}

// First-name nickname/alternate forms for tee time lookup (API vs DB)
const TEE_TIME_FIRST_NAME_ALIASES: Record<string, string[]> = {
  cam: ['cameron'],
  cameron: ['cam'],
  dan: ['daniel'],
  daniel: ['dan'],
  johnny: ['john', 'jon'],
  john: ['johnny', 'jon'],
  jon: ['john', 'johnny'],
  matti: ['matt', 'matthias'],
  matt: ['matthias', 'matti'],
  matthias: ['matt', 'matti'],
  nico: ['nicolas'],
  nicolas: ['nico'],
  's.t.': ['seung taek', 'seung'],
  seung: ['s.t.'],
  'seung taek': ['s.t.'],
};

function firstNamesMatch(apiFirst: string, dbFirst: string): boolean {
  if (apiFirst === dbFirst) return true;
  if (apiFirst.startsWith(dbFirst) || dbFirst.startsWith(apiFirst)) return true;
  const apiAliases = TEE_TIME_FIRST_NAME_ALIASES[apiFirst];
  const dbAliases = TEE_TIME_FIRST_NAME_ALIASES[dbFirst];
  if (apiAliases?.includes(dbFirst)) return true;
  if (dbAliases?.includes(apiFirst)) return true;
  return false;
}

/**
 * Look up tee time data by player name. Tries exact match, accent-normalized match,
 * then last-name + first-name (with nickname) match so API names find DB keys.
 */
function getTeeTimeDataForPlayer(
  teeTimeMap: Map<string, TeeTimeData> | undefined,
  playerName: string
): TeeTimeData | undefined {
  if (!teeTimeMap || !playerName?.trim()) return undefined;
  const exact = teeTimeMap.get(playerName);
  if (exact) return exact;
  const normalized = normalizeNameForTeeTime(playerName);
  for (const [key, data] of teeTimeMap.entries()) {
    if (normalizeNameForTeeTime(key) === normalized) return data;
  }
  const parts = normalized.split(/\s+/);
  if (parts.length >= 2) {
    const apiFirst = parts[0];
    const apiLast = parts[parts.length - 1];
    for (const [key, data] of teeTimeMap.entries()) {
      const keyNorm = normalizeNameForTeeTime(key);
      const keyParts = keyNorm.split(/\s+/);
      if (keyParts.length >= 2 && keyParts[keyParts.length - 1] === apiLast && firstNamesMatch(apiFirst, keyParts[0])) {
        return data;
      }
    }
  }
  return undefined;
}

export function LiveLeaderboard({
  initialData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tournamentId,
  prizeDistributions,
  userRosterPlayerIds,
  playerNameToIdMap,
  liveGolfAPITournamentId,
  espnEventId,
  scorecardSource = 'rapidapi',
  tournamentStatus: initialTournamentStatus,
  currentRound,
  teeTimeMap,
  playerCostMap,
  initialCutLine,
  picksByPlayer = {},
}: LiveLeaderboardProps) {
  const [rightColumnMode, setRightColumnMode] = useState<'Picks' | 'Prize'>('Picks');
  // Use ESPN for live refresh when preferred; otherwise RapidAPI
  const liveRefreshEventId = scorecardSource === 'espn' && espnEventId ? espnEventId : liveGolfAPITournamentId;
  const liveRefreshUrl = scorecardSource === 'espn' && espnEventId
    ? `/api/scores/live?source=espn&eventId=${encodeURIComponent(espnEventId)}`
    : liveGolfAPITournamentId
      ? `/api/scores/live?eventId=${liveGolfAPITournamentId}`
      : null;
  const scorecardEventId = scorecardSource === 'espn' && espnEventId ? espnEventId : liveGolfAPITournamentId;
  const isMobile = useMediaQuery('(max-width: 639px)');
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
    if (!liveRefreshUrl || isRefreshing) return;

    if (isCompleted) {
      console.log('[LiveLeaderboard] Tournament completed, skipping fetch');
      return;
    }

    setIsRefreshing(true);
    setSyncError(null);

    try {
      const response = await fetch(liveRefreshUrl);
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
      
      // Helper to calculate prize money with proper tie handling
      const calculateTiePrizeMoney = (position: number | null, tieCount: number): number => {
        if (!position || position < 1 || tieCount < 1) return 0;
        let totalPrize = 0;
        for (let i = 0; i < tieCount; i++) {
          totalPrize += prizeDistributionMap.get(position + i) || 0;
        }
        return Math.round(totalPrize / tieCount);
      };

      // ESPN: derive position from total score; exclude players who haven't teed off
      let positionByIndex: Map<number, { position: number; tieCount: number }> | null = null;
      if (result.source === 'espn' && Array.isArray(scores) && scores.length > 0) {
        const withScores = scores
          .map((s: APIScorecard, i: number) => ({
            index: i,
            total_score: parseScore(s.total),
            today_score: parseScore(s.currentRoundScore ?? s.total),
            thru: s.thru ?? '-',
          }))
          .filter((r) => hasTeedOff(r.thru));
        const positionResults = assignPositionsByScore(withScores);
        positionByIndex = new Map();
        for (const { item, position, tieCount } of positionResults) {
          positionByIndex.set(item.index, { position, tieCount });
        }
      }

      // Fallback: count by positionValue (RapidAPI sends correct T1, T1, T1)
      const positionCounts = new Map<number, number>();
      if (!positionByIndex) {
        scores.forEach((scorecard: APIScorecard) => {
          const position = scorecard.positionValue ||
            (scorecard.position ? parseInt(scorecard.position.replace('T', '')) : null);
          if (position && position > 0) {
            positionCounts.set(position, (positionCounts.get(position) || 0) + 1);
          }
        });
      }
      
      const transformed: LeaderboardRow[] = scores.map((scorecard: APIScorecard, idx: number) => {
        const teedOff = hasTeedOff(scorecard.thru ?? scorecard.teeTime);
        const fromScore = positionByIndex?.get(idx);
        const position = teedOff
          ? (fromScore
            ? fromScore.position
            : (scorecard.positionValue ?? (scorecard.position ? parseInt(scorecard.position.replace('T', '')) : null)))
          : null;
        const tieCount = fromScore ? fromScore.tieCount : (position ? (positionCounts.get(position) || 1) : 1);
        const isTied = tieCount > 1;
        const todayScore = scorecard.currentRoundScore
          ? parseScore(scorecard.currentRoundScore)
          : parseScore(scorecard.total);
        const isAmateur = scorecard.isAmateur === true;
        const prizeMoney = teedOff && !isAmateur ? calculateTiePrizeMoney(position, tieCount) : 0;

        return {
          position: position ?? null,
          is_tied: isTied,
          tied_with_count: tieCount,
          total_score: parseScore(scorecard.total),
          today_score: todayScore,
          thru: scorecard.thru || '-',
          prize_money: prizeMoney,
          name: scorecard.player || 'Unknown',
          apiPlayerId: scorecard.playerId,
          roundComplete: scorecard.roundComplete === true,
          is_amateur: isAmateur,
          teeTime: scorecard.teeTime,
          hasTeedOff: teedOff,
        };
      });

      // Sort by position then total score
      transformed.sort((a, b) => {
        if (a.position === null) return 1;
        if (b.position === null) return -1;
        if (a.position !== b.position) return a.position - b.position;
        return a.total_score - b.total_score;
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
  }, [liveRefreshUrl, prizeDistributionMap, isCompleted]);

  // Trigger initial fetch on mount - but skip for completed tournaments
  useEffect(() => {
    if (liveRefreshEventId && !hasInitialSynced.current && !isCompleted) {
      hasInitialSynced.current = true;
      // Small delay to prevent flash on initial render
      const timer = setTimeout(() => {
        console.log('[LiveLeaderboard] Fetching initial data from API...');
        fetchFromAPI();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [liveRefreshEventId, fetchFromAPI, isCompleted]);

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
      {liveRefreshEventId && (
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

      <SuspendedStatusBanner
        isSuspended={String(apiTournamentStatus || '').toLowerCase().includes('suspended')}
        statusDetail={
          apiTournamentStatus && apiTournamentStatus !== 'Suspended' ? apiTournamentStatus : undefined
        }
      />

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
            <th className="px-0.5 sm:px-4 py-2 text-center" title="Click score to view scorecard">Today</th>
            <th className="px-0.5 sm:px-4 py-2 text-center" title="Holes completed or tee time">Thru</th>
            <th className="px-0.5 sm:px-4 py-2 text-right">
              <button
                type="button"
                onClick={() => setRightColumnMode((m) => (m === 'Picks' ? 'Prize' : 'Picks'))}
                className="text-xs font-medium text-casino-gold hover:text-casino-gold/80 transition-colors uppercase"
              >
                {rightColumnMode}
              </button>
            </th>
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

            const teedOff = row.hasTeedOff ?? hasTeedOff(row.thru ?? row.teeTime);
            const pos = !teedOff
              ? ''
              : row.position
                ? `${row.is_tied ? 'T' : ''}${row.position}`
                : 'CUT';
            const totalClass = getScoreColor(row.total_score);
            const todayClass = getScoreColor(row.today_score);

            // Use prize_money from row, or look up from prize distribution
            // Amateurs cannot collect prize money
            // R1/R2: zero prize if score is worse than projected cut
            // R3+: only zero if CUT (position null) or amateur — everyone with a standing gets prize
            const cutScoreNum = cutLine ? parseScore(cutLine.cutScore) : null;
            const isRound3OrLater = (currentRound || 1) >= 3;
            const isBelowProjectedCut = !isRound3OrLater && cutLine && row.position !== null && cutScoreNum !== null && row.total_score > cutScoreNum;
            const isCut = row.position === null;
            const showPrizeDash = !teedOff;
            const prizeAmount = showPrizeDash || row.is_amateur || isCut || isBelowProjectedCut
              ? 0
              : (row.prize_money || (row.position ? prizeDistributionMap.get(row.position) : 0) || 0);

            const prevRow = idx > 0 ? leaderboardData[idx - 1] : null;
            
            // Cut line bar: only in R1/R2 (projected cut). R3+ no bar — CUT shows in standing column
            const prevRowScore = prevRow ? prevRow.total_score : null;
            const isProjectedCutPosition = !isRound3OrLater && cutLine &&
              row.position !== null &&
              cutScoreNum !== null &&
              prevRowScore !== null &&
              prevRowScore <= cutScoreNum &&
              row.total_score > cutScoreNum;

            return (
              <Fragment key={`${row.position}-${name}-${idx}`}>
                {/* Cut Line Bar - only R1/R2 */}
                {isProjectedCutPosition && (
                  <tr className="bg-yellow-900/20 border-y-2 border-yellow-500/40">
                    <td colSpan={6} className="px-3 py-2 text-center">
                      <span className="text-yellow-400 font-semibold text-sm">
                        PROJECTED CUT: {cutLine.cutScore}
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
                <td className="px-0.5 sm:px-3 py-2 font-medium text-casino-text text-xs sm:text-sm">
                  {pos}
                </td>
                <td className={`px-0.5 sm:px-3 py-2 text-xs sm:text-sm ${isUserPlayer ? 'font-bold text-casino-gold' : 'text-casino-text'}`}>
                  <span className="truncate block">
                    {isMobile ? formatShortName(name) : name}
                    {row.is_amateur && <span className="text-casino-gray font-normal ml-1">(a)</span>}
                    {playerCost !== undefined && (
                      <span className="text-casino-gray font-normal ml-1">(${playerCost})</span>
                    )}
                  </span>
                </td>
                <td className={`px-0.5 sm:px-4 py-2 font-semibold text-xs sm:text-sm whitespace-nowrap text-center ${totalClass}`}>
                  {formatScore(row.total_score)}
                </td>
                <td className={`px-0.5 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap text-center ${!row.roundComplete && (row.thru === '-' || row.thru === '0' || row.thru === 0 || !row.thru) ? 'text-casino-gray-dark' : todayClass}`}>
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
                <td className="px-0.5 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap text-center">
                  {/* Same order as personal leaderboard: finished → on course → hasn't started (tee time) → dash */}
                  {row.roundComplete || row.thru === 'F' || row.thru === 'F*' || row.thru === 18 || row.thru === '18' ? (
                    /* Player finished current round - show F or F* */
                    <span className="text-casino-green font-medium">{row.thru === 18 || row.thru === '18' ? 'F' : row.thru}</span>
                  ) : row.thru && row.thru !== '-' && row.thru !== '0' && row.thru !== 0 ? (
                    /* Player is on course - show holes completed */
                    <span className="text-casino-blue">{row.thru}</span>
                  ) : (() => {
                    if (row.teeTime) {
                      return <span className="text-casino-gray">{formatTeeTimeDisplay(row.teeTime)}</span>;
                    }
                    // Fallback: look up from DB tee time map
                    const teeTimeData = getTeeTimeDataForPlayer(teeTimeMap, row.name);
                    const teeTimeStr = getTeeTimeForRound(teeTimeData, currentRound);
                    return teeTimeStr ? (
                      <span className="text-casino-gray">{formatTeeTimeDisplay(teeTimeStr)}</span>
                    ) : null;
                  })() ?? (
                    <span className="text-casino-gray-dark">-</span>
                  )}
                </td>
                <td className="px-0.5 sm:px-4 py-2 text-right text-xs sm:text-sm whitespace-nowrap tabular-nums">
                  {rightColumnMode === 'Picks' ? (
                    (() => {
                      const pickCount = picksByPlayer[name] ?? picksByPlayer[matchedMapName] ?? 0;
                      return pickCount > 0 ? (
                        <span className="text-casino-text" title={`${pickCount} team${pickCount !== 1 ? 's' : ''} picked this golfer`}>
                          {pickCount}
                        </span>
                      ) : (
                        <span className="text-casino-gray-dark">—</span>
                      );
                    })()
                  ) : (
                    showPrizeDash ? (
                      <span className="text-casino-gray-dark">—</span>
                    ) : (
                      <span className="text-casino-gold">{formatCurrency(prizeAmount || 0)}</span>
                    )
                  )}
                </td>
              </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>

      {/* Scorecard Modal — ESPN or RapidAPI based on scorecardSource */}
      {scorecardEventId && (
        <ScorecardModal
          isOpen={selectedPlayer !== null}
          onClose={() => setSelectedPlayer(null)}
          playerId={selectedPlayer?.id || ''}
          playerName={selectedPlayer?.name || ''}
          eventId={scorecardEventId}
          source={scorecardSource}
          year={scorecardSource === 'rapidapi' ? new Date().getFullYear().toString() : undefined}
        />
      )}
    </div>
  );
}