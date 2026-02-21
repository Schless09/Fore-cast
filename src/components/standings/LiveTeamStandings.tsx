'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/prize-money';
import { REFRESH_INTERVAL_MS } from '@/lib/config';
import { formatShortName } from '@/lib/utils';
import {
  processLiveScoresForPrizes,
  normalizeNameForLookup,
  firstNamesMatchForLiveScores,
} from '@/lib/live-scores-prizes';
import { formatTeeTimeDisplay } from '@/lib/timezone';

interface RosterData {
  id: string;
  roster_name: string;
  user_id: string;
  username: string;
  /** True when league member did not submit a lineup this week */
  noLineup?: boolean;
  players: Array<{
    playerId: string;
    playerName: string;
    teeTimeR1?: string | null;
    teeTimeR2?: string | null;
    teeTimeR3?: string | null;
    teeTimeR4?: string | null;
    cost?: number;
    // Final data for completed tournaments
    finalPosition?: number | null;
    finalIsTied?: boolean | null;
    finalScore?: number | null;
    finalPrizeMoney?: number | null;
    isAmateur?: boolean | null;
    madeCut?: boolean | null;
    /** From processLiveScoresForPrizes (includes "MC" for cut players) */
    positionDisplay?: string;
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
  roundComplete?: boolean;
  isAmateur?: boolean;
  teeTime?: string; // Tee time from RapidAPI (e.g., "11:35am")
}

interface LiveTeamStandingsProps {
  tournamentId: string;
  liveGolfAPITournamentId: string;
  espnEventId?: string | null;
  scorecardSource?: 'espn' | 'rapidapi';
  prizeDistributions: Array<{
    position: number;
    amount: number;
  }>;
  currentUserId: string;
  /** If the current user is a co-manager, this is the team owner's user ID */
  coManagedOwnerId?: string;
  tournamentStatus: string;
  userLeagueId?: string;
  /** When provided, filter rosters by league membership (not active_league_id) so multi-league users show in each league's standings */
  leagueMemberIds?: string[];
  displayRound?: number;
  /** In R1/R2, zero winnings for players below this cut (projected cut). */
  cutLine?: { cutScore: string; cutCount: number } | null;
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
  espnEventId,
  scorecardSource = 'rapidapi',
  prizeDistributions,
  currentUserId,
  coManagedOwnerId,
  tournamentStatus,
  userLeagueId,
  leagueMemberIds,
  displayRound = 1,
  cutLine,
}: LiveTeamStandingsProps) {
  const isCompleted = tournamentStatus === 'completed';
  const isMobile = useMediaQuery('(max-width: 639px)');
  const [rosters, setRosters] = useState<RosterData[]>([]);
  const [liveScores, setLiveScores] = useState<LiveScore[]>([]);
  const [liveSource, setLiveSource] = useState<'espn' | 'rapidapi'>(scorecardSource);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextRefreshIn, setNextRefreshIn] = useState(REFRESH_INTERVAL_MS / 1000);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [expandedRosterIds, setExpandedRosterIds] = useState<Set<string>>(new Set());
  const [selectedPlayerNames, setSelectedPlayerNames] = useState<Set<string>>(new Set());
  const hasInitialLoaded = useRef(false);
  const hasSetDefaultUserExpand = useRef(false);

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
    const match = playerScoreMap.get(normalizedName);
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
          if (fuzzyLastName === lastName && firstNamesMatchForLiveScores(firstName, fuzzyFirstName)) {
            return score;
          }
        }
      }
    }
    
    return undefined;
  }, [playerScoreMap]);

  // Shared prize logic: position-from-score (ESPN), tie split; in R1/R2 zero winnings below cut
  const prizeDataByPlayer = useMemo(() => {
    if (!liveScores.length) return new Map<string, { winnings: number; hasTeedOff: boolean; positionDisplay?: string }>();
    const processed = processLiveScoresForPrizes(liveScores, liveSource, prizeMap, {
      cutLine: cutLine ?? undefined,
      currentRound: displayRound,
    });
    const byPlayer = new Map<string, { winnings: number; hasTeedOff: boolean; positionDisplay?: string }>();
    processed.forEach((data, key) => {
      byPlayer.set(key, { winnings: data.winnings, hasTeedOff: data.hasTeedOff, positionDisplay: data.positionDisplay });
    });
    return byPlayer;
  }, [liveScores, liveSource, prizeMap, cutLine, displayRound]);

  // Calculate winnings for each roster based on live scores OR stored final data
  const rostersWithLiveWinnings = useMemo(() => {
    return rosters.map((roster) => {
      let totalWinnings = 0;
      const playersWithScores = roster.players.map((player) => {
        // For completed tournaments, use stored final data
        if (isCompleted) {
          const winnings = player.finalPrizeMoney || 0;
          totalWinnings += winnings;
          const isCut = player.madeCut === false;
          return {
            ...player,
            liveScore: (player.finalPosition || isCut) ? {
              player: player.playerName,
              playerId: player.playerId,
              position: isCut ? 'MC' : (player.finalIsTied ? `T${player.finalPosition}` : String(player.finalPosition)),
              positionValue: isCut ? null : player.finalPosition,
              total: player.finalScore !== null && player.finalScore !== undefined
                ? (player.finalScore === 0 ? 'E' : (player.finalScore > 0 ? `+${player.finalScore}` : String(player.finalScore)))
                : '-',
              thru: 'F',
              currentRoundScore: '-',
              roundComplete: true,
              isAmateur: player.isAmateur ?? false,
            } as LiveScore : undefined,
            winnings,
            isAmateur: player.isAmateur ?? false,
            hasTeedOff: true, // Completed: all players finished
          };
        }
        
        // For active tournaments, use shared prize logic
        const liveScore = findLiveScore(player.playerName);
        const lookupKey = liveScore ? normalizeNameForLookup(liveScore.player) : null;
        const prizeData = lookupKey ? prizeDataByPlayer.get(lookupKey) : null;
        const winnings = prizeData?.winnings ?? 0;
        totalWinnings += winnings;

        return {
          ...player,
          liveScore,
          winnings,
          isAmateur: liveScore?.isAmateur === true,
          hasTeedOff: prizeData?.hasTeedOff ?? false,
          positionDisplay: prizeData?.positionDisplay,
        };
      });

      playersWithScores.sort((a, b) => b.winnings - a.winnings);

      return {
        ...roster,
        playersWithScores,
        totalWinnings,
      };
    }).sort((a, b) => {
      if (b.totalWinnings !== a.totalWinnings) return b.totalWinnings - a.totalWinnings;
      if (a.noLineup && !b.noLineup) return 1;
      if (!a.noLineup && b.noLineup) return -1;
      if (a.noLineup && b.noLineup) return a.username.localeCompare(b.username);
      return 0;
    });
  }, [rosters, findLiveScore, prizeDataByPlayer, isCompleted]);

  // Map: normalized player name -> roster IDs that have that player
  const playerNameToRosterIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const roster of rostersWithLiveWinnings) {
      if (roster.noLineup) continue;
      for (const p of roster.playersWithScores) {
        const key = normalizeName(p.playerName);
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(roster.id);
      }
    }
    return map;
  }, [rostersWithLiveWinnings]);

  // When user clicks a player name: toggle selection and expand/collapse rosters accordingly
  const handlePlayerNameClick = useCallback(
    (e: React.MouseEvent, playerName: string) => {
      e.stopPropagation();
      const key = normalizeName(playerName);
      setSelectedPlayerNames((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        // Compute which roster IDs to expand: intersection of roster sets for each selected player
        if (next.size === 0) {
          setExpandedRosterIds(new Set());
          return next;
        }
        const sets = Array.from(next)
          .map((n) => playerNameToRosterIds.get(n))
          .filter(Boolean) as Set<string>[];
        if (sets.length === 0) {
          setExpandedRosterIds(new Set());
          return next;
        }
        const intersection = sets.reduce((acc, s) => {
          const result = new Set<string>();
          for (const id of acc) {
            if (s.has(id)) result.add(id);
          }
          return result;
        });
        setExpandedRosterIds(intersection);
        return next;
      });
    },
    [playerNameToRosterIds]
  );

  const clearPlayerFilter = useCallback(() => {
    setSelectedPlayerNames(new Set());
    setExpandedRosterIds(new Set());
  }, []);

  // Fetch rosters from database
  const fetchRosters = useCallback(async () => {
    const supabase = createClient();
    
    // Get rosters with their players, filtered by league membership (so multi-league users show in each league's standings)
    // Include final scores for completed tournaments
    let query = supabase
      .from('user_rosters')
      .select(`
        id,
        roster_name,
        user_id,
        profiles(username),
        roster_players(
          player_winnings,
          tournament_player:tournament_players(
            pga_player_id,
            tee_time_r1,
            tee_time_r2,
            tee_time_r3,
            tee_time_r4,
            cost,
            position,
            is_tied,
            total_score,
            prize_money,
            made_cut,
            pga_players(name, is_amateur)
          )
        )
      `)
      .eq('tournament_id', tournamentId);

    if (leagueMemberIds && leagueMemberIds.length > 0) {
      query = query.in('user_id', leagueMemberIds);
    } else if (userLeagueId) {
      query = query.eq('profiles.active_league_id', userLeagueId);
    }

    const { data: rostersData, error } = await query;

    if (error) {
      console.error('Error fetching rosters:', error);
      return;
    }

    type RawRosterRow = {
      id: string;
      roster_name: string;
      user_id: string;
      profiles?: { username?: string } | { username?: string }[] | null;
      roster_players?: Array<{
        player_winnings?: number | null;
        tournament_player?: {
          pga_player_id?: string;
          pga_players?: { name?: string; is_amateur?: boolean } | null;
          tee_time_r1?: string | null;
          tee_time_r2?: string | null;
          tee_time_r3?: string | null;
          tee_time_r4?: string | null;
          cost?: number;
          position?: number | null;
          is_tied?: boolean | null;
          total_score?: number | null;
          prize_money?: number | null;
          made_cut?: boolean | null;
        } | null;
      }> | null;
    };
    const rows = (rostersData || []) as RawRosterRow[];
    const transformedRosters: RosterData[] = rows.map((r) => {
      const profiles = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        id: r.id,
        roster_name: r.roster_name,
        user_id: r.user_id,
        username: profiles?.username || 'Unknown',
        players: (r.roster_players || []).map((rp) => ({
          playerId: rp.tournament_player?.pga_player_id ?? '',
          playerName: rp.tournament_player?.pga_players?.name || 'Unknown',
          teeTimeR1: rp.tournament_player?.tee_time_r1,
          teeTimeR2: rp.tournament_player?.tee_time_r2,
          teeTimeR3: rp.tournament_player?.tee_time_r3,
          teeTimeR4: rp.tournament_player?.tee_time_r4,
          cost: rp.tournament_player?.cost,
          finalPosition: rp.tournament_player?.position,
          finalIsTied: rp.tournament_player?.is_tied,
          finalScore: rp.tournament_player?.total_score,
          finalPrizeMoney: rp.player_winnings ?? rp.tournament_player?.prize_money,
          isAmateur: rp.tournament_player?.pga_players?.is_amateur,
          madeCut: rp.tournament_player?.made_cut,
        })),
      };
    });

    // Include all league members: add placeholders for those who didn't set a lineup
    if (leagueMemberIds && leagueMemberIds.length > 0) {
      const hasRosterIds = new Set(transformedRosters.map((r) => r.user_id));
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', leagueMemberIds);
      const usernameById = new Map((profilesData || []).map((p) => [p.id, p.username ?? '—']));
      for (const userId of leagueMemberIds) {
        if (!hasRosterIds.has(userId)) {
          transformedRosters.push({
            id: `no-lineup-${userId}`,
            roster_name: usernameById.get(userId) ?? '—',
            user_id: userId,
            username: usernameById.get(userId) ?? '—',
            noLineup: true,
            players: [],
          });
        }
      }
    }

    setRosters(transformedRosters);
  }, [tournamentId, userLeagueId, leagueMemberIds]);

  // Fetch live scores from API (skip for completed tournaments)
  const fetchLiveScores = useCallback(async () => {
    const effectiveUrl = scorecardSource === 'espn' && espnEventId
      ? `/api/scores/live?source=espn&eventId=${encodeURIComponent(espnEventId)}`
      : liveGolfAPITournamentId
        ? `/api/scores/live?eventId=${liveGolfAPITournamentId}`
        : null;
    if (isCompleted || !effectiveUrl || isRefreshing) return;

    setIsRefreshing(true);
    setSyncError(null);

    try {
      const response = await fetch(effectiveUrl);
      const result = await response.json();

      if (!response.ok || !result.data) {
        setSyncError(result.error || 'Failed to fetch scores');
        return;
      }

      setLiveScores(result.data);
      setLiveSource(result.source === 'espn' ? 'espn' : 'rapidapi');
      console.log('[LiveTeamStandings] Refreshed scores at', new Date().toLocaleTimeString());
    } catch (error) {
      setSyncError('Network error - unable to refresh scores');
      console.error('[LiveTeamStandings] Error:', error);
    } finally {
      setIsRefreshing(false);
      setNextRefreshIn(REFRESH_INTERVAL_MS / 1000);
    }
  }, [liveGolfAPITournamentId, espnEventId, scorecardSource, isRefreshing, isCompleted]);

  // Initial load
  useEffect(() => {
    if (!hasInitialLoaded.current) {
      hasInitialLoaded.current = true;
      fetchRosters();
      fetchLiveScores();
    }
  }, [fetchRosters, fetchLiveScores]);

  // Default to user's row expanded when standings first load
  // For co-managers, expand the team they co-manage
  useEffect(() => {
    if (hasSetDefaultUserExpand.current) return;
    if (!rosters.length || !currentUserId) return;
    const userRoster = rosters.find((r) => r.user_id === currentUserId);
    const coManagedRoster = coManagedOwnerId ? rosters.find((r) => r.user_id === coManagedOwnerId) : null;
    if (!userRoster && !coManagedRoster) return;
    hasSetDefaultUserExpand.current = true;
    setExpandedRosterIds((prev) => {
      const next = new Set(prev);
      if (userRoster) next.add(userRoster.id);
      if (coManagedRoster) next.add(coManagedRoster.id);
      return next;
    });
  }, [rosters, currentUserId, coManagedOwnerId]);

  // Polling interval (skip for completed tournaments)
  useEffect(() => {
    if (isCompleted) return; // No polling needed for completed tournaments
    
    const pollInterval = setInterval(fetchLiveScores, REFRESH_INTERVAL_MS);
    const countdownInterval = setInterval(() => {
      setNextRefreshIn((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(countdownInterval);
    };
  }, [fetchLiveScores, isCompleted]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // For co-managers, show the co-managed team's rank if they don't have their own roster
  const effectiveUserId = rostersWithLiveWinnings.some((r) => r.user_id === currentUserId)
    ? currentUserId
    : coManagedOwnerId || currentUserId;
  const userRank = rostersWithLiveWinnings.findIndex((r) => r.user_id === effectiveUserId) + 1;
  const userRoster = rostersWithLiveWinnings.find((r) => r.user_id === effectiveUserId);

  return (
    <div>
      {/* Refresh Status Bar */}
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
              onClick={fetchLiveScores}
              disabled={isRefreshing}
              className="text-xs px-2 py-0.5 text-casino-gold hover:text-casino-gold/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRefreshing ? '...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {/* Expand/Collapse + Player Filter */}
      <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
        {selectedPlayerNames.size > 0 && (
          <button
            onClick={clearPlayerFilter}
            className="text-xs px-3 py-1 bg-casino-gold/20 text-casino-gold hover:bg-casino-gold/30 border border-casino-gold/40 rounded transition-colors"
          >
            Clear filter
            <span className="ml-1">
              ({Array.from(selectedPlayerNames)
                .map((n) => {
                  const roster = rostersWithLiveWinnings.find((r) =>
                    r.playersWithScores.some((p) => normalizeName(p.playerName) === n)
                  );
                  return roster?.playersWithScores.find((p) => normalizeName(p.playerName) === n)?.playerName ?? n;
                })
                .join(', ')})
            </span>
          </button>
        )}
        <button
          onClick={expandedRosterIds.size === rosters.length ? collapseAll : expandAll}
          className="text-xs px-3 py-1 bg-casino-card hover:bg-casino-elevated text-casino-gray hover:text-casino-text border border-casino-gold/20 rounded transition-colors"
        >
          {expandedRosterIds.size === rosters.length ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* Standings Table: Rank | Team (name + players below) | Pos | Score | Thru | Win | Winnings (rightmost) */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-casino-gold/30">
              <th className="px-px sm:px-2 py-1.5 text-left text-xs font-medium text-casino-gray uppercase sm:tracking-wider w-8 sm:w-14">
                Rank
              </th>
              <th className="px-px sm:px-2 py-1.5 text-left text-xs font-medium text-casino-gray uppercase sm:tracking-wider min-w-0">
                Team
              </th>
              <th className="px-px sm:px-4 py-1.5 text-center text-xs font-medium text-casino-gray uppercase sm:tracking-wider min-w-0 sm:min-w-14">
                Pos
              </th>
              <th className="px-px sm:px-4 py-1.5 text-center text-xs font-medium text-casino-gray uppercase sm:tracking-wider min-w-0 sm:min-w-16">
                Score
              </th>
              <th className="px-px sm:px-4 py-1.5 text-center text-xs font-medium text-casino-gray uppercase sm:tracking-wider min-w-0 sm:min-w-18">
                Thru
              </th>
              {/* Mobile: one column for winnings (no $ label) */}
              {isMobile ? (
                <th colSpan={2} className="px-px sm:px-4 py-1.5 text-right text-xs font-medium text-casino-gray uppercase sm:tracking-wider min-w-0">
                  Winnings
                </th>
              ) : (
                <>
                  <th className="px-1 sm:px-4 py-1.5 text-right text-xs font-medium text-casino-gray uppercase tracking-wider min-w-10 sm:min-w-20">
                    $
                  </th>
                  <th className="px-1 sm:px-4 py-1.5 text-right text-xs font-medium text-casino-gray uppercase tracking-wider min-w-14 sm:min-w-24">
                    Winnings
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rostersWithLiveWinnings.map((roster, index) => {
              const isUserRoster = roster.user_id === currentUserId || roster.user_id === coManagedOwnerId;
              const isNoLineup = roster.noLineup === true;
              const isExpanded = expandedRosterIds.has(roster.id);
              const rank = index + 1;
              const rowBg = isUserRoster ? 'bg-casino-green/10 hover:bg-casino-green/20' : 'hover:bg-casino-card/50';
              const detailBg = isUserRoster ? 'bg-casino-green/5' : 'bg-casino-elevated';

              return (
                <Fragment key={roster.id}>
                  <tr
                    className={`border-b border-casino-gold/20 transition-colors ${!isNoLineup ? 'cursor-pointer' : ''} ${rowBg}`}
                    onClick={() => !isNoLineup && toggleRoster(roster.id)}
                  >
                    <td className="px-px sm:px-2 py-1.5">
                      <div className="flex items-center gap-1 sm:gap-2">
                        {!isNoLineup ? (
                          <button className="p-0.5 hover:bg-casino-gold/20 rounded transition-colors">
                            <svg
                              className={`w-3 h-3 sm:w-4 sm:h-4 text-casino-gold transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        ) : (
                          <span className="w-3 sm:w-4 inline-block" />
                        )}
                        <span className="text-xs sm:text-sm font-medium text-casino-text">{rank}</span>
                        {rank === 1 && !isNoLineup && <span className="text-sm sm:text-base">🏆</span>}
                        {isUserRoster && (
                          <span className="px-1 sm:px-1.5 py-0.5 bg-casino-green/30 text-casino-green border border-casino-green/50 rounded text-xs font-medium">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td colSpan={isMobile ? 4 : 5} className="px-px sm:px-2 py-1.5 min-w-0">
                      <span className="font-medium text-casino-text text-xs sm:text-sm wrap-break-word">{roster.roster_name}</span>
                    </td>
                    <td colSpan={isMobile ? 2 : 1} className="px-px sm:px-4 py-1.5 text-right">
                      {isNoLineup ? (
                        <span className="text-casino-gray text-xs sm:text-sm">No lineup</span>
                      ) : (
                        <span className={`font-semibold text-xs sm:text-sm ${roster.totalWinnings > 0 ? 'text-casino-green' : 'text-casino-gray-dark'}`}>
                          {formatCurrency(roster.totalWinnings)}
                        </span>
                      )}
                    </td>
                  </tr>

                  {isExpanded && !isNoLineup && roster.playersWithScores.map((player, idx) => {
                    const getTeeTimeForRound = () => {
                      if (displayRound === 1) return player.teeTimeR1;
                      if (displayRound === 2) return player.teeTimeR2;
                      if (displayRound === 3) return player.teeTimeR3;
                      if (displayRound === 4) return player.teeTimeR4;
                      return player.teeTimeR1;
                    };
                    const teeTime = getTeeTimeForRound();
                    const thruCell = (() => {
                      if (player.liveScore?.roundComplete || player.liveScore?.thru === 'F' || player.liveScore?.thru === 'F*') {
                        return <span className="text-casino-green font-medium">{player.liveScore?.thru === '18' ? 'F' : player.liveScore?.thru}</span>;
                      }
                      if (player.liveScore?.thru && player.liveScore.thru !== '-' && player.liveScore.thru !== '0') {
                        return <span className="text-casino-blue">{player.liveScore.thru}</span>;
                      }
                      if (player.liveScore?.teeTime) return <span className="text-casino-gray">{formatTeeTimeDisplay(player.liveScore.teeTime)}</span>;
                      if (teeTime) return <span className="text-casino-gray">{formatTeeTimeDisplay(teeTime)}</span>;
                      return <span className="text-casino-gray-dark">-</span>;
                    })();
                    return (
                      <tr key={`${roster.id}-player-${idx}`} className={`border-b border-casino-gold/10 ${detailBg} hover:bg-casino-card/50 transition-colors`}>
                        {/* Rank + Team columns merged for golfer rows */}
                        <td colSpan={2} className="px-px sm:px-2 py-1 sm:py-1.5 text-xs sm:text-sm text-casino-text">
                          <span className="block border-l-2 border-casino-gold/20 truncate pl-1 sm:pl-2">
                            <button
                              type="button"
                              onClick={(e) => handlePlayerNameClick(e, player.playerName)}
                              className={`text-left hover:underline focus:outline-none focus:ring-1 focus:ring-casino-gold rounded px-0.5 -mx-0.5 ${selectedPlayerNames.has(normalizeName(player.playerName)) ? 'text-casino-gold font-semibold ring-1 ring-casino-gold/50 rounded' : ''}`}
                            >
                              {isMobile ? formatShortName(player.playerName) : player.playerName}
                            </button>
                            {player.isAmateur && <span className="text-casino-gray ml-1">(a)</span>}
                            {player.cost !== undefined && player.cost !== null && (
                              <span className="text-casino-gray font-normal ml-1">(${player.cost})</span>
                            )}
                          </span>
                        </td>
                        {/* Pos */}
                        <td className="px-px sm:px-4 py-1 sm:py-1.5 text-xs text-center">
                          {(player.positionDisplay ?? player.liveScore?.position) ? (
                            <span className={`font-medium ${
                              (player.positionDisplay ?? player.liveScore?.position) === 'MC' ? 'text-casino-red' :
                              player.liveScore?.positionValue === 1 ? 'text-casino-gold' :
                              (player.liveScore?.positionValue || 999) <= 10 ? 'text-casino-green' : 'text-casino-text'
                            }`}>
                              {player.positionDisplay ?? player.liveScore?.position}
                            </span>
                          ) : (
                            <span className="text-casino-gray-dark">-</span>
                          )}
                        </td>
                        {/* Score */}
                        <td className="px-px sm:px-4 py-1 sm:py-1.5 text-xs text-center">
                          {player.liveScore ? (
                            <span className={
                              parseScore(player.liveScore.total) < 0 ? 'text-casino-green' :
                              parseScore(player.liveScore.total) > 0 ? 'text-casino-red' : 'text-casino-gray'
                            }>
                              {player.liveScore.total}
                            </span>
                          ) : (
                            <span className="text-casino-gray-dark">-</span>
                          )}
                        </td>
                        {/* Thru */}
                        <td className="px-px sm:px-4 py-1 sm:py-1.5 text-xs text-center whitespace-nowrap">
                          {thruCell}
                        </td>
                        {/* Winnings */}
                        {isMobile ? (
                          <td colSpan={2} className="px-px py-1 sm:py-1.5 text-xs text-right">
                            <span className={player.winnings > 0 ? 'text-casino-text' : 'text-casino-gray-dark'}>
                              {formatCurrency(player.winnings)}
                            </span>
                          </td>
                        ) : (
                          <>
                            <td className="px-1 sm:px-4 py-1 sm:py-1.5 text-xs text-right">
                              <span className={player.winnings > 0 ? 'text-casino-text' : 'text-casino-gray-dark'}>
                                {formatCurrency(player.winnings)}
                              </span>
                            </td>
                            <td className="px-1 sm:px-4 py-1 sm:py-1.5" />
                          </>
                        )}
                      </tr>
                    );
                  })}
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
                {userRoster.noLineup ? 'No lineup' : formatCurrency(userRoster.totalWinnings)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
