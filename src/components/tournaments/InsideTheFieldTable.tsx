'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/prize-money';
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

interface InsideTheFieldTableProps {
  playerStats: PlayerSelectionStats[];
  totalRosters: number;
}

const VALUE_TOOLTIP = 'Return per dollar spent (earnings ÷ cost)';

export function InsideTheFieldTable({ playerStats, totalRosters }: InsideTheFieldTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('picked');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showValueTooltip, setShowValueTooltip] = useState(false);
  const [valueTooltipCoords, setValueTooltipCoords] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'pos' ? 'asc' : 'desc'); // pos: asc (1 first); others: desc
    }
  };

  const sortedStats = useMemo(() => {
    const arr = [...playerStats];
    arr.sort((a, b) => {
      let aVal: number | string | null;
      let bVal: number | string | null;
      switch (sortKey) {
        case 'picked':
          aVal = a.selectionCount;
          bVal = b.selectionCount;
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
  }, [playerStats, sortKey, sortDir]);

  const SortHeader = ({ label, sortKey: k, align = 'center', title }: { label: string; sortKey: SortKey; align?: 'left' | 'center' | 'right'; title?: string }) => (
    <th
      className={`px-1 sm:px-3 py-3 cursor-pointer select-none hover:text-casino-gold transition-colors ${align === 'right' ? 'text-right' : align === 'left' ? 'text-left' : 'text-center'}`}
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
            <th className="px-1 sm:px-3 py-3 w-8">#</th>
            <th className="px-1 sm:px-3 py-3">Player</th>
            <SortHeader label="Picked" sortKey="picked" />
            <SortHeader label="POS" sortKey="pos" />
            <SortHeader label="Earnings" sortKey="earnings" align="right" />
            <th
              className="px-1 sm:px-3 py-3 cursor-pointer select-none hover:text-casino-gold transition-colors text-right"
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
            return (
              <tr
                key={player.playerName}
                className={`border-b transition-colors ${
                  player.isOnUserRoster
                    ? 'bg-casino-gold/20 border-casino-gold/40 hover:bg-casino-gold/30'
                    : 'border-casino-gold/10 hover:bg-casino-elevated'
                }`}
              >
                <td className="px-1 sm:px-3 py-3 text-casino-gray">
                  {index + 1}
                </td>
                <td className={`px-1 sm:px-3 py-3 font-medium ${player.isOnUserRoster ? 'text-casino-gold' : 'text-casino-text'}`}>
                  <div className="flex flex-col">
                    <span>
                      {player.playerName}
                      <span className="text-casino-gray font-normal ml-1">(${player.cost})</span>
                    </span>
                    <span className="text-xs text-casino-gray sm:hidden">
                      {player.selectionCount}/{totalRosters} teams ({player.percentage}%)
                    </span>
                  </div>
                </td>
                <td className="px-1 sm:px-3 py-3 text-center">
                  <PickedByTooltip
                    selectionCount={player.selectionCount}
                    percentage={player.percentage}
                    totalRosters={totalRosters}
                    pickedByUsers={player.pickedByUsers}
                  />
                </td>
                <td className="px-1 sm:px-3 py-3 text-center">
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
                <td className="px-1 sm:px-3 py-3 text-right">
                  <span className={player.prizeMoney > 0 ? 'text-casino-green' : 'text-casino-gray-dark'}>
                    {formatCurrency(player.prizeMoney)}
                  </span>
                </td>
                <td className="px-1 sm:px-3 py-3 text-right" title="Return per $1 of salary cap spent on this player (earnings ÷ cost)">
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
