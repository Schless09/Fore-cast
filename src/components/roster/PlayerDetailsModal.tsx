'use client';

import { useState, useEffect } from 'react';
import { PGAPlayer } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

interface TournamentHistory {
  year: number;
  position: string;
  score: string;
  earnings: number;
  sg_total: number | null;
}

interface RecentStart {
  tournament: string;
  date: string;
  position: string;
  score: string;
  made_cut: boolean;
  sg_total: number | null;
  earnings: number;
}

interface PlayerStats {
  starts: number;
  madeCuts: number;
  missedCuts: number;
  top10s: number;
  top25s: number;
  avgFinish: string;
  avgSgTotal: string | null;
}

interface PlayerDetailsModalProps {
  player: PGAPlayer;
  cost: number;
  isOpen: boolean;
  onClose: () => void;
  tournamentName?: string;
  venueId?: string;
}

export function PlayerDetailsModal({
  player,
  cost,
  isOpen,
  onClose,
  tournamentName = 'This Tournament',
  venueId,
}: PlayerDetailsModalProps) {
  const [tournamentHistory, setTournamentHistory] = useState<TournamentHistory[]>([]);
  const [last25Starts, setLast25Starts] = useState<RecentStart[]>([]);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchPlayerHistory() {
      setIsLoading(true);
      const supabase = createClient();

      try {
        // Fetch tournament history at this venue/tournament
        let historyQuery = supabase
          .from('historical_tournament_results')
          .select('*')
          .eq('pga_player_id', player.id)
          .order('tournament_date', { ascending: false });

        // Filter by venue_id if available, otherwise by tournament name
        if (venueId) {
          historyQuery = historyQuery.eq('venue_id', venueId);
        } else if (tournamentName && tournamentName !== 'This Tournament') {
          historyQuery = historyQuery.ilike('tournament_name', `%${tournamentName}%`);
        }

        const { data: historyData } = await historyQuery.limit(10);

        if (historyData && historyData.length > 0) {
          setHasData(true);
          setTournamentHistory(historyData.map(h => {
            // Calculate score relative to par (assume par 72 per round, 4 rounds = 288 for full tournament)
            // For missed cuts (2 rounds), par would be 144
            const parTotal = h.is_made_cut === false ? 144 : 288;
            const relativeScore = h.total_score ? h.total_score - parTotal : null;
            
            return {
              year: new Date(h.tournament_date).getFullYear(),
              position: h.is_made_cut === false ? 'MC' : 
                       h.finish_position ? (h.finish_position <= 10 ? `T${h.finish_position}` : `${h.finish_position}`) : '-',
              score: relativeScore !== null 
                ? (relativeScore > 0 ? `+${relativeScore}` : relativeScore === 0 ? 'E' : `${relativeScore}`)
                : '-',
              earnings: h.prize_money || 0,
              sg_total: h.strokes_gained_total,
            };
          }));
        }

        // Fetch last 25 starts (any tournament)
        const { data: recentData } = await supabase
          .from('historical_tournament_results')
          .select('*')
          .eq('pga_player_id', player.id)
          .order('tournament_date', { ascending: false })
          .limit(25);

        if (recentData && recentData.length > 0) {
          setHasData(true);
          const starts = recentData.map(r => {
            // Calculate score relative to par (assume par 72 per round, 4 rounds = 288 for full tournament)
            // For missed cuts (2 rounds), par would be 144
            const parTotal = r.is_made_cut === false ? 144 : 288;
            const relativeScore = r.total_score ? r.total_score - parTotal : null;
            
            return {
              tournament: r.tournament_name,
              date: new Date(r.tournament_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
              position: r.is_made_cut === false ? 'MC' :
                       r.finish_position ? (r.finish_position <= 10 ? `T${r.finish_position}` : `${r.finish_position}`) : '-',
              score: relativeScore !== null 
                ? (relativeScore > 0 ? `+${relativeScore}` : relativeScore === 0 ? 'E' : `${relativeScore}`)
                : '-',
              made_cut: r.is_made_cut !== false,
              sg_total: r.strokes_gained_total,
              earnings: r.prize_money || 0,
            };
          });

          setLast25Starts(starts);

          // Calculate stats
          const madeCuts = starts.filter(s => s.made_cut).length;
          const missedCuts = starts.filter(s => !s.made_cut).length;
          const finishes = starts.filter(s => s.made_cut && s.position !== '-');
          
          const top10s = finishes.filter(s => {
            const pos = parseInt(s.position.replace('T', ''));
            return !isNaN(pos) && pos <= 10;
          }).length;
          
          const top25s = finishes.filter(s => {
            const pos = parseInt(s.position.replace('T', ''));
            return !isNaN(pos) && pos <= 25;
          }).length;

          const avgFinish = finishes.length > 0
            ? (finishes.reduce((sum, s) => {
                const pos = parseInt(s.position.replace('T', ''));
                return sum + (isNaN(pos) ? 50 : pos);
              }, 0) / finishes.length).toFixed(1)
            : '-';

          const sgValues = starts.filter(s => s.sg_total !== null).map(s => s.sg_total as number);
          const avgSgTotal = sgValues.length > 0
            ? (sgValues.reduce((a, b) => a + b, 0) / sgValues.length).toFixed(2)
            : null;

          setStats({
            starts: starts.length,
            madeCuts,
            missedCuts,
            top10s,
            top25s,
            avgFinish,
            avgSgTotal,
          });
        }
      } catch (error) {
        console.error('Error fetching player history:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPlayerHistory();
  }, [isOpen, player.id, tournamentName, venueId]);

  if (!isOpen) return null;

  // Use real data if available, otherwise show rankings only
  const worldRanking = player.world_ranking;
  const fedexRanking = player.fedex_cup_ranking;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-casino-card rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-casino-gold/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-casino-dark to-casino-elevated px-5 py-4 border-b border-casino-gold/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-casino-text">{player.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                {player.country && (
                  <span className="text-sm text-casino-gray">{player.country}</span>
                )}
                <span className="text-lg font-bold text-casino-green">${cost.toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-casino-gray hover:text-casino-text transition-colors p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)] space-y-6">
          {/* Rankings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-casino-dark/50 rounded-lg p-4 border border-casino-gold/10">
              <div className="text-xs text-casino-gray uppercase tracking-wide mb-1">World Ranking</div>
              <div className="text-3xl font-bold text-casino-gold font-orbitron">
                {worldRanking ? `#${worldRanking}` : 'N/A'}
              </div>
            </div>
            <div className="bg-casino-dark/50 rounded-lg p-4 border border-casino-gold/10">
              <div className="text-xs text-casino-gray uppercase tracking-wide mb-1">FedEx Cup Rank</div>
              <div className="text-3xl font-bold text-casino-green font-orbitron">
                {fedexRanking ? `#${fedexRanking}` : 'N/A'}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-casino-gold mx-auto mb-2"></div>
              <p className="text-casino-gray text-sm">Loading player history...</p>
            </div>
          ) : !hasData ? (
            <div className="text-center py-8 bg-casino-dark/30 rounded-lg border border-casino-gold/10">
              <p className="text-casino-gray">No historical data available for this player yet.</p>
              <p className="text-casino-gray text-sm mt-1">Data will be populated as tournaments complete.</p>
            </div>
          ) : (
            <>
              {/* Last 25 Starts Stats */}
              {stats && (
                <div>
                  <h3 className="text-sm font-semibold text-casino-gold mb-3 flex items-center gap-2">
                    <span>📊</span> Last {stats.starts} Starts Summary
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <div className="bg-casino-dark/30 rounded-lg p-3 text-center border border-casino-gold/10">
                      <div className="text-lg font-bold text-casino-text">{stats.starts}</div>
                      <div className="text-xs text-casino-gray">Starts</div>
                    </div>
                    <div className="bg-casino-dark/30 rounded-lg p-3 text-center border border-casino-gold/10">
                      <div className="text-lg font-bold text-casino-green">{stats.madeCuts}</div>
                      <div className="text-xs text-casino-gray">Made Cuts</div>
                    </div>
                    <div className="bg-casino-dark/30 rounded-lg p-3 text-center border border-casino-gold/10">
                      <div className="text-lg font-bold text-red-400">{stats.missedCuts}</div>
                      <div className="text-xs text-casino-gray">Missed Cuts</div>
                    </div>
                    <div className="bg-casino-dark/30 rounded-lg p-3 text-center border border-casino-gold/10">
                      <div className="text-lg font-bold text-casino-gold">{stats.top10s}</div>
                      <div className="text-xs text-casino-gray">Top 10s</div>
                    </div>
                    <div className="bg-casino-dark/30 rounded-lg p-3 text-center border border-casino-gold/10">
                      <div className="text-lg font-bold text-casino-text">{stats.top25s}</div>
                      <div className="text-xs text-casino-gray">Top 25s</div>
                    </div>
                    <div className="bg-casino-dark/30 rounded-lg p-3 text-center border border-casino-gold/10">
                      <div className="text-lg font-bold text-casino-text">{stats.avgFinish}</div>
                      <div className="text-xs text-casino-gray">Avg Finish</div>
                    </div>
                  </div>
                  {stats.avgSgTotal && (
                    <div className="mt-2 text-center">
                      <span className="text-xs text-casino-gray">Avg Strokes Gained: </span>
                      <span className={`text-sm font-bold ${parseFloat(stats.avgSgTotal) >= 0 ? 'text-casino-green' : 'text-red-400'}`}>
                        {parseFloat(stats.avgSgTotal) >= 0 ? '+' : ''}{stats.avgSgTotal}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Tournament History */}
              {tournamentHistory.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-casino-gold mb-3 flex items-center gap-2">
                    <span>🏌️</span> History at {tournamentName}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-casino-gold/20">
                          <th className="px-3 py-2 text-left text-xs font-medium text-casino-gray uppercase">Year</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-casino-gray uppercase">Finish</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-casino-gray uppercase">Score</th>
                          {tournamentHistory.some(h => h.sg_total !== null) && (
                            <th className="px-3 py-2 text-right text-xs font-medium text-casino-gray uppercase">SG</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {tournamentHistory.map((history, idx) => (
                          <tr key={idx} className="border-b border-casino-gold/10 hover:bg-casino-dark/30">
                            <td className="px-3 py-2 text-casino-text">{history.year}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`font-semibold ${
                                history.position === 'MC' ? 'text-red-400' :
                                history.position === '1' ? 'text-casino-gold' :
                                parseInt(history.position.replace('T', '')) <= 10 ? 'text-casino-green' :
                                'text-casino-text'
                              }`}>
                                {history.position}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center text-casino-gray">{history.score}</td>
                            {tournamentHistory.some(h => h.sg_total !== null) && (
                              <td className="px-3 py-2 text-right">
                                <span className={history.sg_total && history.sg_total >= 0 ? 'text-casino-green' : 'text-red-400'}>
                                  {history.sg_total !== null ? (history.sg_total >= 0 ? '+' : '') + history.sg_total.toFixed(1) : '-'}
                                </span>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Last 25 Starts Table */}
              {last25Starts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-casino-gold mb-3 flex items-center gap-2">
                    <span>📋</span> Last {last25Starts.length} Starts
                  </h3>
                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-casino-card">
                        <tr className="border-b border-casino-gold/20">
                          <th className="px-3 py-2 text-left text-xs font-medium text-casino-gray uppercase">Tournament</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-casino-gray uppercase">Date</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-casino-gray uppercase">Finish</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-casino-gray uppercase">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {last25Starts.map((start, idx) => (
                          <tr key={idx} className="border-b border-casino-gold/10 hover:bg-casino-dark/30">
                            <td className="px-3 py-2 text-casino-text text-xs">{start.tournament}</td>
                            <td className="px-3 py-2 text-center text-casino-gray text-xs">{start.date}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`font-semibold text-xs ${
                                start.position === 'MC' ? 'text-red-400' :
                                start.position === '-' ? 'text-casino-gray' :
                                parseInt(start.position.replace('T', '')) <= 10 ? 'text-casino-green' :
                                'text-casino-text'
                              }`}>
                                {start.position}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center text-casino-gray text-xs">{start.score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-casino-dark/50 border-t border-casino-gold/20">
          <button
            onClick={onClose}
            className="w-full py-2 bg-casino-gold/20 hover:bg-casino-gold/30 text-casino-gold rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
