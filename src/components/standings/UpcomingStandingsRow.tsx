'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { convertESTtoLocal } from '@/lib/timezone';
import { formatShortName } from '@/lib/utils';

interface RosterInfo {
  id: string;
  roster_name: string;
  user_id: string;
}

interface UpcomingStandingsRowProps {
  row: {
    user_id: string;
    username: string;
    hasRoster: boolean;
    roster?: RosterInfo | null;
  };
  index: number;
  tournamentId: string;
  currentUserId: string;
}

interface RosterPlayerRow {
  tournament_player: {
    tee_time_r1: string | null;
    pga_players: { name: string } | null;
  } | null;
}

export function UpcomingStandingsRow({
  row,
  index,
  tournamentId,
  currentUserId,
}: UpcomingStandingsRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [players, setPlayers] = useState<RosterPlayerRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isUser = row.user_id === currentUserId;
  const canExpand = row.hasRoster && row.roster;

  const loadPlayers = async () => {
    if (!row.roster?.id) return;
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('roster_players')
        .select(
          `
          tournament_player:tournament_players(
            tee_time_r1,
            pga_players(name)
          )
        `
        )
        .eq('roster_id', row.roster.id);

      if (error) {
        console.error('Error fetching roster players:', error);
      } else {
        setPlayers((data || []) as RosterPlayerRow[]);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = () => {
    if (!canExpand) return;
    if (!isExpanded && players.length === 0) {
      loadPlayers();
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      <tr
        className={`border-b border-casino-gold/10 transition-colors ${
          isUser ? 'bg-casino-green/10' : ''
        } ${canExpand ? 'hover:bg-casino-card/50' : ''}`}
      >
        <td className="px-1 sm:px-2 py-2">
          <div className="flex items-center gap-1 sm:gap-2">
            {canExpand && (
              <button
                onClick={toggleExpand}
                className="p-0.5 hover:bg-casino-gold/20 rounded transition-colors"
                aria-label={isExpanded ? 'Collapse roster' : 'Expand roster'}
              >
                <svg
                  className={`w-3 h-3 sm:w-4 sm:h-4 text-casino-gold transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}
            <span className="text-casino-text font-medium">{index + 1}</span>
          </div>
        </td>
        <td className="px-1 sm:px-2 py-2">
          <span className="text-casino-text font-medium">{row.username}</span>
          {isUser && (
            <span className="ml-2 text-xs text-casino-green font-medium">You</span>
          )}
        </td>
        <td className="px-1 sm:px-2 py-2 text-right">
          {row.hasRoster ? (
            <span className="text-casino-green font-medium">Set</span>
          ) : (
            <span className="text-casino-gray">Not set</span>
          )}
        </td>
      </tr>

      {isExpanded && canExpand && (
        <tr className={isUser ? 'bg-casino-green/5' : 'bg-casino-elevated'}>
          <td colSpan={3} className="px-1 sm:px-2 py-2">
            {isLoading ? (
              <div className="text-center py-3 text-casino-gray text-xs sm:text-sm">
                Loading roster...
              </div>
            ) : players.length > 0 ? (
              <div className="pl-2 sm:pl-6">
                <h4 className="text-xs font-semibold text-casino-gold uppercase mb-1.5">
                  {row.roster?.roster_name || 'Team'} — Roster ({players.length} players)
                </h4>
                <div className="overflow-x-auto -mx-1 sm:mx-0">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead className="bg-casino-card border-b border-casino-gold/20">
                      <tr>
                        <th className="px-1 sm:px-2 py-1 text-left text-xs font-medium text-casino-gray uppercase">
                          Player
                        </th>
                        <th className="px-1 sm:px-2 py-1 text-right text-xs font-medium text-casino-gray uppercase">
                          R1 Tee Time
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-casino-bg divide-y divide-casino-gold/10">
                      {players.map((rp, idx) => {
                        const tp = rp.tournament_player;
                        const name = tp?.pga_players?.name ?? '—';
                        const teeTimeR1 = tp?.tee_time_r1;
                        const displayTime = teeTimeR1
                          ? convertESTtoLocal(teeTimeR1)
                          : '—';
                        return (
                          <tr key={idx} className="hover:bg-casino-card/50 transition-colors">
                            <td className="px-1 sm:px-2 py-1.5 text-casino-text">
                              <span className="sm:hidden">{formatShortName(name)}</span>
                              <span className="hidden sm:inline">{name}</span>
                            </td>
                            <td className="px-1 sm:px-2 py-1.5 text-right text-casino-gray">
                              {displayTime}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-3 text-casino-gray text-sm">
                No players in this roster
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
