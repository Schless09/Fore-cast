'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatScore, getScoreColor } from '@/lib/utils';
import { formatCurrency } from '@/lib/prize-money';
import { ScorecardModal } from './ScorecardModal';

interface LeaderboardRow {
  position: number | null;
  is_tied: boolean;
  tied_with_count: number;
  total_score: number;
  today_score: number;
  thru: string | number;
  prize_money: number;
  name: string;
  prize_distribution?: {
    position: number;
    percentage: number | null;
    amount: number;
    total_purse: number;
  };
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
}

export function LiveLeaderboard({
  initialData,
  tournamentId,
  prizeDistributions,
  userRosterPlayerIds,
  playerNameToIdMap,
}: LiveLeaderboardProps) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardRow[]>(initialData);
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardRow | null>(null);
  const [showScorecard, setShowScorecard] = useState(false);

  const handleScorecardClick = (player: LeaderboardRow) => {
    setSelectedPlayer(player);
    setShowScorecard(true);
  };
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardRow | null>(null);
  const [showScorecard, setShowScorecard] = useState(false);

  useEffect(() => {
    // Subscribe to real-time updates for tournament players
    const supabase = createClient();
    const channel = supabase
      .channel(`leaderboard-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_players',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        async () => {
          // Refetch leaderboard data when tournament_players table changes
          const { data: freshData } = await supabase
            .from('tournament_players')
            .select(
              `
              position,
              is_tied,
              tied_with_count,
              total_score,
              today_score,
              thru,
              prize_money,
              pga_players ( name )
            `
            )
            .eq('tournament_id', tournamentId)
            .not('position', 'is', null)
            .order('position', { ascending: true });

          if (freshData) {
            const processedData = freshData.map((row: any) => ({
              position: row.position ?? null,
              is_tied: row.is_tied ?? false,
              tied_with_count: row.tied_with_count ?? 1,
              total_score: row.total_score ?? 0,
              today_score: row.today_score ?? 0,
              thru: row.thru ?? '-',
              prize_money: row.prize_money ?? 0,
              name: row.pga_players?.name || 'Unknown',
            }));

            setLeaderboardData(processedData);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  const prizeDistributionMap = new Map(
    prizeDistributions.map((dist) => [
      dist.position,
      {
        position: dist.position,
        percentage: dist.percentage,
        amount: dist.amount,
        total_purse: dist.total_purse,
      },
    ])
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
            <th className="px-2 sm:px-4 py-2">Pos</th>
            <th className="px-2 sm:px-4 py-2">Golfer</th>
            <th className="px-2 sm:px-4 py-2">Total</th>
            <th className="px-2 sm:px-4 py-2">Today</th>
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

            // Use calculated prize_money from database first, then fall back to distribution
            const prizeAmount = row.prize_money ||
              row.prize_distribution?.amount ||
              (row.position && prizeDistributionMap.has(row.position)
                ? prizeDistributionMap.get(row.position)?.amount
                : 0);

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
                <td className={`px-2 sm:px-4 py-2 text-xs sm:text-sm ${todayClass} cursor-pointer hover:bg-casino-gold/10 transition-colors`} onClick={() => handleScorecardClick(row)} title="Click for detailed scorecard">
                  {formatScore(row.today_score)}
                </td>
                <td className="px-2 sm:px-4 py-2 text-casino-gray text-xs sm:text-sm hidden sm:table-cell">
                  {row.thru && row.thru !== '-' && row.thru !== '0' ? row.thru : '-'}
                </td>
                <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm text-casino-gold">
                  {formatCurrency(prizeAmount || 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selectedPlayer && (
        <ScorecardModal
          player={selectedPlayer}
          tournamentId={tournamentId}
          isOpen={showScorecard}
          onClose={() => {
            setShowScorecard(false);
            setSelectedPlayer(null);
          }}
        />
      )}
    </div>
  );
}