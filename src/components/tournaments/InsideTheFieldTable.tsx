'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/prize-money';
import { formatShortName } from '@/lib/utils';
import { PickedByTooltip } from '@/components/ui/PickedByTooltip';

export interface PlayerSelectionStats {
  playerName: string;
  selectionCount: number;
  percentage: number;
  position: string | null;
  prizeMoney: number;
  isOnUserRoster: boolean;
  cost: number;
  pickedByUsers: string[];
}

type SortKey = 'picked' | 'pos' | 'earnings' | 'roi';
type SortDir = 'asc' | 'desc';

function parsePosForSort(pos: string | null): number {
  if (!pos) return 9999; // CUT / no position at end
  const num = parseInt(pos.replace('T', ''), 10);
  return isNaN(num) ? 9999 : num;
}

const BUDGET_CAP = 30;

/** Return per $1 of cap spent on this player. Used for sorting (higher = more cost-effective). */
function valueForSort(prizeMoney: number, cost: number): number | null {
  if (cost <= 0) return null;
  return (BUDGET_CAP * prizeMoney) / cost;
}

/** Display: earnings per $1 of salary cap spent on this player (earnings/cost). */
function valueForDisplay(prizeMoney: number, cost: number): number | null {
  if (cost <= 0) return null;
  return prizeMoney / cost;
}

export interface SeasonPickStats {
  selectionCount: number;
  percentage: number;
  pickedByUsers: string[];
  /** Combined earnings across all season tournaments (for All Season view) */
  totalEarnings?: number;
  /** Sum of cost in each event where player was picked (for All Season value calc) */
  totalCost?: number;
}

interface InsideTheFieldTableProps {
  playerStats: PlayerSelectionStats[];
  totalRosters: number;
  seasonStats?: Record<string, SeasonPickStats>;
  totalSeasonSlots?: number;
}

const VALUE_TOOLTIP = 'Return per dollar spent (earnings ÷ cost)';

type ViewMode = 'tournament' | 'season';

export function InsideTheFieldTable({
  playerStats,
  totalRosters,
  seasonStats = {},
  totalSeasonSlots = 0,
}: InsideTheFieldTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('picked');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('tournament');
  const [showValueTooltip, setShowValueTooltip] = useState(false);
  const [valueTooltipCoords, setValueTooltipCoords] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const hasSeasonData = totalSeasonSlots > 0 && Object.keys(seasonStats).length > 0;

  // In season view, show all players with season totals (earnings, cost) for display and value calc
  const statsToDisplay = useMemo(() => {
    if (viewMode !== 'season' || !hasSeasonData) return playerStats;
    const byName = new Map<string, PlayerSelectionStats>(playerStats.map((p) => [p.playerName, p]));
    const merged: PlayerSelectionStats[] = [];
    for (const [playerName, season] of Object.entries(seasonStats)) {
      const existing = byName.get(playerName);
      const seasonEarnings = season.totalEarnings ?? 0;
      const seasonCost = season.totalCost ?? 0;
      if (existing) {
        merged.push({
          ...existing,
          prizeMoney: seasonEarnings,
          cost: seasonCost,
          position: null, // no single POS in season view
        });
      } else {
        merged.push({
          playerName,
          selectionCount: season.selectionCount,
          percentage: season.percentage,
          position: null,
          prizeMoney: seasonEarnings,
          isOnUserRoster: false,
          cost: seasonCost,
          pickedByUsers: season.pickedByUsers,
        });
      }
    }
    return merged;
  }, [viewMode, hasSeasonData, playerStats, seasonStats]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (viewMode === 'season' && sortKey === 'pos') setSortKey('earnings');
  }, [viewMode, sortKey]);

  const isSeasonView = viewMode === 'season';

  const handleSort = (key: SortKey) => {
    if (key === 'pos' && isSeasonView) return; // no POS in season view
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'pos' ? 'asc' : 'desc'); // pos: asc (1 first); others: desc
    }
  };

  const sortedStats = useMemo(() => {
    const arr = [...statsToDisplay];
    const getPickedCount = (p: PlayerSelectionStats) =>
      viewMode === 'season' ? (seasonStats[p.playerName]?.selectionCount ?? 0) : p.selectionCount;
    arr.sort((a, b) => {
      let aVal: number | string | null;
      let bVal: number | string | null;
      switch (sortKey) {
        case 'picked':
          aVal = getPickedCount(a);
          bVal = getPickedCount(b);
          break;
        case 'pos':
          aVal = parsePosForSort(a.position);
          bVal = parsePosForSort(b.position);
          break;
        case 'earnings':
          aVal = a.prizeMoney;
          bVal = b.prizeMoney;
          break;
        case 'roi':
          aVal = valueForSort(a.prizeMoney, a.cost);
          bVal = valueForSort(b.prizeMoney, b.cost);
          break;
        default:
          return 0;
      }
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return sortDir === 'asc' ? 1 : -1;
      if (bVal === null) return sortDir === 'asc' ? -1 : 1;
      const cmp = typeof aVal === 'number' && typeof bVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [statsToDisplay, sortKey, sortDir, viewMode, seasonStats]);

  const SortHeader = ({ label, sortKey: k, align = 'center', title }: { label: string; sortKey: SortKey; align?: 'left' | 'center' | 'right'; title?: string }) => (
    <th
      className={`px-1 sm:px-3 py-2 cursor-pointer select-none hover:text-casino-gold transition-colors ${align === 'right' ? 'text-right' : align === 'left' ? 'text-left' : 'text-center'}`}
      onClick={() => handleSort(k)}
      title={title}
    >
      {label}
      {sortKey === k && (
        <span className="ml-1 text-casino-gold">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </th>
  );

  return (
    <div className="space-y-3">
      {hasSeasonData && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-casino-gray">Picked:</span>
          <button
            type="button"
            onClick={() => setViewMode('tournament')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'tournament'
                ? 'bg-casino-gold/30 text-casino-gold border border-casino-gold/50'
                : 'bg-casino-card text-casino-gray border border-casino-gold/20 hover:border-casino-gold/40'
            }`}
          >
            This tournament
          </button>
          <button
            type="button"
            onClick={() => setViewMode('season')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'season'
                ? 'bg-casino-gold/30 text-casino-gold border border-casino-gold/50'
                : 'bg-casino-card text-casino-gray border border-casino-gold/20 hover:border-casino-gold/40'
            }`}
          >
            All season
          </button>
          {viewMode === 'season' && (
            <span className="text-xs text-casino-gray">
              ({totalSeasonSlots.toLocaleString()} roster slots this season)
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
            <th className="px-1 sm:px-3 py-2 w-8">#</th>
            <th className="px-1 sm:px-3 py-2">Player</th>
            <SortHeader label="Picked" sortKey="picked" />
            {!isSeasonView && <SortHeader label="POS" sortKey="pos" />}
            <SortHeader label="Earnings" sortKey="earnings" align="right" />
            <th
              className="px-1 sm:px-3 py-2 cursor-pointer select-none hover:text-casino-gold transition-colors text-right"
              onClick={() => handleSort('roi')}
            >
              <span className="inline-flex items-center gap-1">
                Value
                {sortKey === 'roi' && (
                  <span className="ml-1 text-casino-gold">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
                <span
                  className="text-casino-gray hover:text-casino-gold cursor-default text-xs font-normal normal-case"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setValueTooltipCoords({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                    setShowValueTooltip(true);
                  }}
                  onMouseLeave={() => setShowValueTooltip(false)}
                >
                  ⓘ
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedStats.map((player, index) => {
            const value = valueForDisplay(player.prizeMoney, player.cost);
            const isSeason = viewMode === 'season';
            const picked = isSeason
              ? (seasonStats[player.playerName] ?? { selectionCount: 0, percentage: 0, pickedByUsers: [] })
              : { selectionCount: player.selectionCount, percentage: player.percentage, pickedByUsers: player.pickedByUsers };
            const pickedTotal = isSeason ? totalSeasonSlots : totalRosters;
            return (
              <tr
                key={player.playerName}
                className={`border-b transition-colors ${
                  player.isOnUserRoster
                    ? 'bg-casino-gold/20 border-casino-gold/40 hover:bg-casino-gold/30'
                    : 'border-casino-gold/10 hover:bg-casino-elevated'
                }`}
              >
                <td className="px-1 sm:px-3 py-1.5 text-casino-gray">
                  {index + 1}
                </td>
                <td className={`px-1 sm:px-3 py-1.5 font-medium ${player.isOnUserRoster ? 'text-casino-gold' : 'text-casino-text'}`}>
                  <span title={player.playerName}>
                    {formatShortName(player.playerName)}
                    <span
                      className="text-casino-gray font-normal ml-1"
                      title={isSeasonView ? 'Avg cost per pick this season' : undefined}
                    >
                      ({isSeasonView && picked.selectionCount
                        ? (Number(player.cost ?? 0) / picked.selectionCount).toFixed(2)
                        : (Number(player.cost ?? 0)).toFixed(2)})
                    </span>
                  </span>
                </td>
                <td className="px-1 sm:px-3 py-1.5 text-center">
                  <PickedByTooltip
                    selectionCount={picked.selectionCount}
                    percentage={picked.percentage}
                    totalRosters={pickedTotal}
                    pickedByUsers={picked.pickedByUsers}
                    isSeason={isSeason}
                  />
                </td>
                {!isSeasonView && (
                  <td className="px-1 sm:px-3 py-1.5 text-center">
                    {player.position ? (
                      <span className={`font-medium ${
                        parseInt(player.position.replace('T', '')) === 1 ? 'text-casino-gold' :
                        parseInt(player.position.replace('T', '')) <= 10 ? 'text-casino-green' :
                        'text-casino-text'
                      }`}>
                        {player.position}
                      </span>
                    ) : (
                      <span className="text-casino-gray-dark">-</span>
                    )}
                  </td>
                )}
                <td className="px-1 sm:px-3 py-1.5 text-right">
                  <span className={player.prizeMoney > 0 ? 'text-casino-green' : 'text-casino-gray-dark'}>
                    {formatCurrency(player.prizeMoney)}
                  </span>
                </td>
                <td className="px-1 sm:px-3 py-1.5 text-right" title="Return per $1 of salary cap spent on this player (earnings ÷ cost)">
                  {value !== null ? (
                    <span className={value > 0 ? 'text-casino-green' : 'text-casino-gray'}>
                      {formatCurrency(value)}
                    </span>
                  ) : (
                    <span className="text-casino-gray-dark">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      {mounted && showValueTooltip && createPortal(
        <div
          className="fixed z-[100] px-2 py-1.5 text-xs text-white bg-gray-900 border border-casino-gold/40 rounded shadow-lg max-w-[200px] text-center pointer-events-none"
          style={{
            left: valueTooltipCoords.x,
            top: valueTooltipCoords.y,
            transform: 'translate(-50%, 0)',
          }}
        >
          {VALUE_TOOLTIP}
        </div>,
        document.body
      )}
    </div>
  );
}
