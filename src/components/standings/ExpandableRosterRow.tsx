'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/prize-money';

interface ExpandableRosterRowProps {
  roster: any;
  index: number;
  isUserRoster: boolean;
  tournamentId: string;
  tournamentStatus: string;
  currentUserId: string;
}

export function ExpandableRosterRow({
  roster,
  index,
  isUserRoster,
  tournamentId,
  tournamentStatus,
  currentUserId,
}: ExpandableRosterRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const rank = index + 1;
  const winnings = roster.total_winnings || 0;

  // Can view roster if: it's your own roster, OR tournament is active/completed
  const canViewRoster = isUserRoster || tournamentStatus === 'active' || tournamentStatus === 'completed';

  const toggleExpand = async () => {
    if (!canViewRoster) {
      return; // Do nothing if can't view
    }

    if (!isExpanded && players.length === 0) {
      // Fetch players
      setIsLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('roster_players')
          .select(`
            player_winnings,
            tournament_player:tournament_players(
              position,
              prize_money,
              total_score,
              made_cut,
              pga_players(name, country, image_url)
            )
          `)
          .eq('roster_id', roster.id)
          .order('player_winnings', { ascending: false });

        if (error) {
          console.error('Error fetching roster players:', error);
        } else {
          setPlayers(data || []);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    setIsExpanded(!isExpanded);
  };

  return (
    <>
      <tr
        className={`border-b border-casino-gold/20 transition-colors ${
          isUserRoster
            ? 'bg-casino-green/10 hover:bg-casino-green/20'
            : 'hover:bg-casino-card/50'
        }`}
      >
        <td className="px-1 sm:px-2 py-1.5">
          <div className="flex items-center gap-1 sm:gap-2">
            {canViewRoster && (
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
            <span className="text-xs sm:text-sm font-medium text-casino-text">
              {rank}
            </span>
            {rank === 1 && (
              <span className="text-sm sm:text-base">🏆</span>
            )}
            {isUserRoster && (
              <span className="px-1 sm:px-1.5 py-0.5 bg-casino-green/30 text-casino-green border border-casino-green/50 rounded text-xs font-medium">
                You
              </span>
            )}
          </div>
        </td>
        <td className="px-1 sm:px-2 py-1.5">
          <span className="font-medium text-casino-text text-xs sm:text-sm">
            {roster.roster_name}
          </span>
        </td>
        <td className="px-1 sm:px-2 py-1.5 text-right">
          <span
            className={`font-semibold text-xs sm:text-sm ${
              winnings > 0 ? 'text-casino-green' : 'text-casino-gray-dark'
            }`}
          >
            {formatCurrency(winnings)}
          </span>
        </td>
      </tr>

      {/* Expanded Player List */}
      {isExpanded && (
        <tr className={isUserRoster ? 'bg-casino-green/5' : 'bg-casino-elevated'}>
          <td colSpan={3} className="px-1 sm:px-2 py-2">
            {isLoading ? (
              <div className="text-center py-3 text-casino-gray text-xs sm:text-sm">
                Loading roster...
              </div>
            ) : players.length > 0 ? (
              <div className="pl-2 sm:pl-6">
                <h4 className="text-xs font-semibold text-casino-gold uppercase mb-1.5">
                  Team Roster ({players.length} players)
                </h4>
                <div className="overflow-x-auto -mx-1 sm:mx-0">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead className="bg-casino-card border-b border-casino-gold/20">
                      <tr>
                        <th className="px-1 sm:px-2 py-1 text-left text-xs font-medium text-casino-gray uppercase">
                          Player
                        </th>
                        <th className="px-1 sm:px-2 py-1 text-center text-xs font-medium text-casino-gray uppercase">
                          Pos
                        </th>
                        <th className="px-1 sm:px-2 py-1 text-center text-xs font-medium text-casino-gray uppercase hidden sm:table-cell">
                          Score
                        </th>
                        <th className="px-1 sm:px-2 py-1 text-center text-xs font-medium text-casino-gray uppercase hidden md:table-cell">
                          Tee
                        </th>
                        <th className="px-1 sm:px-2 py-1 text-right text-xs font-medium text-casino-gray uppercase">
                          Win
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-casino-bg divide-y divide-casino-gold/10">
                      {players.map((rp: any, idx: number) => {
                        const tp = rp.tournament_player;
                        const player = tp?.pga_players;
                        
                        return (
                          <tr key={idx} className="hover:bg-casino-card/50 transition-colors">
                            <td className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm text-casino-text">
                              <div className="flex items-center gap-1 sm:gap-2">
                                {player?.image_url ? (
                                  <img
                                    src={player.image_url}
                                    alt={player.name}
                                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover shrink-0 border border-casino-gold/20"
                                  />
                                ) : (
                                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-casino-card border border-casino-gold/20 flex items-center justify-center text-xs shrink-0">
                                    <span className="text-casino-gray">
                                      {player?.name?.charAt(0) || '?'}
                                    </span>
                                  </div>
                                )}
                                <span className="truncate">{player?.name || 'Unknown'}</span>
                                {player?.country && (
                                  <span className="text-xs hidden sm:inline" title={player.country}>
                                    {getFlagEmoji(player.country)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm text-center">
                              {tp?.position ? (
                                <span className={`font-medium ${
                                  tp.position === 1 ? 'text-casino-gold' :
                                  tp.position <= 10 ? 'text-casino-green' :
                                  'text-casino-text'
                                }`}>
                                  {tp.position > 1 ? 'T' : ''}{tp.position}
                                </span>
                              ) : (
                                <span className="text-casino-gray-dark">-</span>
                              )}
                            </td>
                            <td className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm text-center hidden sm:table-cell">
                              {tp?.made_cut === false ? (
                                <span className="text-casino-red font-medium">CUT</span>
                              ) : tp?.total_score ? (
                                <span className={
                                  tp.total_score < 0 ? 'text-casino-green' :
                                  tp.total_score > 0 ? 'text-casino-red' :
                                  'text-casino-gray'
                                }>
                                  {tp.total_score > 0 ? '+' : ''}{tp.total_score}
                                </span>
                              ) : (
                                <span className="text-casino-gray-dark">-</span>
                              )}
                            </td>
                            <td className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm text-center hidden md:table-cell">
                              {tp?.tee_time ? (
                                <span className="text-casino-gray">
                                  {new Date(tp.tee_time).toLocaleTimeString('en-US', { 
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                    // Uses user's local timezone automatically
                                  })}
                                </span>
                              ) : (
                                <span className="text-casino-gray-dark">-</span>
                              )}
                            </td>
                            <td className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm text-right">
                              <span
                                className={
                                  (rp.player_winnings || 0) > 0
                                    ? 'text-casino-green font-semibold'
                                    : 'text-casino-gray-dark'
                                }
                              >
                                {formatCurrency(rp.player_winnings || 0)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-casino-card border-t border-casino-gold/30">
                      <tr>
                        <td
                          colSpan={2}
                          className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm font-semibold text-casino-gold text-right sm:hidden"
                        >
                          Total:
                        </td>
                        <td
                          colSpan={3}
                          className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm font-semibold text-casino-gold text-right hidden sm:table-cell md:hidden"
                        >
                          Total Winnings:
                        </td>
                        <td
                          colSpan={4}
                          className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm font-semibold text-casino-gold text-right hidden md:table-cell"
                        >
                          Total Winnings:
                        </td>
                        <td className="px-1 sm:px-2 py-1.5 text-xs sm:text-sm font-bold text-casino-green text-right">
                          {formatCurrency(winnings)}
                        </td>
                      </tr>
                    </tfoot>
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

      {/* Locked Message for Upcoming Tournaments */}
      {!canViewRoster && (
        <tr className="hidden">
          <td colSpan={3}></td>
        </tr>
      )}
    </>
  );
}

// Helper to get flag emoji
function getFlagEmoji(countryCode: string) {
  if (!countryCode) return '';
  
  // Convert 3-letter codes to 2-letter ISO codes
  const countryMap: Record<string, string> = {
    'USA': 'US',
    'GBR': 'GB',
    'CAN': 'CA',
    'AUS': 'AU',
    'JPN': 'JP',
    'KOR': 'KR',
    'CHN': 'CN',
    'MEX': 'MX',
    'ESP': 'ES',
    'FRA': 'FR',
    'GER': 'DE',
    'ITA': 'IT',
    'SWE': 'SE',
    'NOR': 'NO',
    'DEN': 'DK',
    'FIN': 'FI',
    'IRL': 'IE',
    'SCO': 'GB', // Scotland uses GB flag
    'ENG': 'GB', // England uses GB flag
    'WAL': 'GB', // Wales uses GB flag
    'NIR': 'GB', // Northern Ireland uses GB flag
    'ARG': 'AR',
    'BRA': 'BR',
    'CHI': 'CL',
    'COL': 'CO',
    'RSA': 'ZA',
    'NZL': 'NZ',
    'IND': 'IN',
    'THA': 'TH',
    'PHI': 'PH',
    'TAI': 'TW',
    'VEN': 'VE',
  };

  try {
    const code = countryCode.toUpperCase();
    // Use mapped code if 3 letters, otherwise use first 2 chars
    const twoLetterCode = countryMap[code] || code.substring(0, 2);
    
    const codePoints = twoLetterCode
      .split('')
      .map((char) => 0x1f1e6 + char.charCodeAt(0) - 'A'.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return '';
  }
}
