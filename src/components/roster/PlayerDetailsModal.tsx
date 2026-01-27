'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  sg_off_tee: number | null;
  sg_approach: number | null;
  sg_around_green: number | null;
  sg_putting: number | null;
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
  avgSgOffTee: string | null;
  avgSgApproach: string | null;
  avgSgAroundGreen: string | null;
  avgSgPutting: string | null;
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
  tournamentName: rawTournamentName,
  venueId,
}: PlayerDetailsModalProps) {
  // Normalize tournament name - treat empty string as undefined
  const tournamentName = rawTournamentName?.trim() || 'This Tournament';
  
  const [tournamentHistory, setTournamentHistory] = useState<TournamentHistory[]>([]);
  const [last25Starts, setLast25Starts] = useState<RecentStart[]>([]);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  // Close on escape key and lock body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

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
              sg_off_tee: r.strokes_gained_off_tee,
              sg_approach: r.strokes_gained_approach,
              sg_around_green: r.strokes_gained_around_green,
              sg_putting: r.strokes_gained_putting,
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

          // Calculate SG breakdown averages
          const calcAvg = (values: (number | null)[]) => {
            const valid = values.filter((v): v is number => v !== null);
            return valid.length > 0 ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2) : null;
          };

          setStats({
            starts: starts.length,
            madeCuts,
            missedCuts,
            top10s,
            top25s,
            avgFinish,
            avgSgTotal,
            avgSgOffTee: calcAvg(starts.map(s => s.sg_off_tee)),
            avgSgApproach: calcAvg(starts.map(s => s.sg_approach)),
            avgSgAroundGreen: calcAvg(starts.map(s => s.sg_around_green)),
            avgSgPutting: calcAvg(starts.map(s => s.sg_putting)),
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

  // Use portal to render at document body level (escapes any parent transforms)
  if (typeof document === 'undefined') return null;
  
  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          zIndex: 9999,
        }}
        onClick={onClose}
      />
      
      {/* Modal - centered */}
      <div 
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10000,
          width: '90vw',
          maxWidth: '672px',
          maxHeight: '85vh',
          overflow: 'hidden',
          borderRadius: '12px',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        className="bg-casino-card"
        onClick={e => e.stopPropagation()}
      >
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

        <div className="p-5 overflow-y-auto max-h-[calc(85vh-140px)] space-y-6">
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
                  {/* SG Breakdown */}
                  {(stats.avgSgOffTee || stats.avgSgApproach || stats.avgSgAroundGreen || stats.avgSgPutting) && (
                    <div className="mt-3 p-3 bg-casino-dark/40 rounded-lg border border-casino-gold/20">
                      <div className="text-xs text-casino-gray text-center mb-2">SG Breakdown (Avg)</div>
                      <div className="grid grid-cols-5 gap-1 text-center">
                        <div>
                          <div className="text-[10px] text-casino-gray uppercase">OT</div>
                          <div className={`text-sm font-bold ${stats.avgSgOffTee && parseFloat(stats.avgSgOffTee) >= 0 ? 'text-casino-green' : 'text-red-400'}`}>
                            {stats.avgSgOffTee ? (parseFloat(stats.avgSgOffTee) >= 0 ? '+' : '') + stats.avgSgOffTee : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-casino-gray uppercase">APP</div>
                          <div className={`text-sm font-bold ${stats.avgSgApproach && parseFloat(stats.avgSgApproach) >= 0 ? 'text-casino-green' : 'text-red-400'}`}>
                            {stats.avgSgApproach ? (parseFloat(stats.avgSgApproach) >= 0 ? '+' : '') + stats.avgSgApproach : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-casino-gray uppercase">ARG</div>
                          <div className={`text-sm font-bold ${stats.avgSgAroundGreen && parseFloat(stats.avgSgAroundGreen) >= 0 ? 'text-casino-green' : 'text-red-400'}`}>
                            {stats.avgSgAroundGreen ? (parseFloat(stats.avgSgAroundGreen) >= 0 ? '+' : '') + stats.avgSgAroundGreen : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-casino-gray uppercase">PUT</div>
                          <div className={`text-sm font-bold ${stats.avgSgPutting && parseFloat(stats.avgSgPutting) >= 0 ? 'text-casino-green' : 'text-red-400'}`}>
                            {stats.avgSgPutting ? (parseFloat(stats.avgSgPutting) >= 0 ? '+' : '') + stats.avgSgPutting : '-'}
                          </div>
                        </div>
                        <div className="border-l border-casino-gold/20">
                          <div className="text-[10px] text-casino-gray uppercase">Total</div>
                          <div className={`text-sm font-bold ${stats.avgSgTotal && parseFloat(stats.avgSgTotal) >= 0 ? 'text-casino-green' : 'text-red-400'}`}>
                            {stats.avgSgTotal ? (parseFloat(stats.avgSgTotal) >= 0 ? '+' : '') + stats.avgSgTotal : '-'}
                          </div>
                        </div>
                      </div>
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

              {/* Last 25 Starts Table - Compact with scroll */}
              {last25Starts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-casino-gold mb-2 flex items-center gap-2">
                    <span>📋</span> Last {last25Starts.length} Starts
                  </h3>
                  <div className="max-h-[200px] overflow-auto border border-casino-gold/20 rounded-lg">
                    <table className="w-full text-sm md:min-w-[600px]">
                      <thead className="sticky top-0 bg-casino-elevated">
                        <tr className="border-b border-casino-gold/20">
                          <th className="px-2 py-1.5 text-left text-xs font-medium text-casino-gray uppercase whitespace-nowrap">Tournament</th>
                          <th className="px-2 py-1.5 text-center text-xs font-medium text-casino-gray uppercase">Date</th>
                          <th className="px-2 py-1.5 text-center text-xs font-medium text-casino-gray uppercase">Fin</th>
                          <th className="px-2 py-1.5 text-center text-xs font-medium text-casino-gray uppercase">Score</th>
                          <th className="hidden md:table-cell px-1.5 py-1.5 text-center text-xs font-medium text-casino-gray uppercase" title="Off the Tee">OT</th>
                          <th className="hidden md:table-cell px-1.5 py-1.5 text-center text-xs font-medium text-casino-gray uppercase" title="Approach">APP</th>
                          <th className="hidden md:table-cell px-1.5 py-1.5 text-center text-xs font-medium text-casino-gray uppercase" title="Around Green">AG</th>
                          <th className="hidden md:table-cell px-1.5 py-1.5 text-center text-xs font-medium text-casino-gray uppercase" title="Putting">PUT</th>
                          <th className="px-1.5 py-1.5 text-center text-xs font-medium text-casino-gray uppercase" title="Total SG">SG</th>
                        </tr>
                      </thead>
                      <tbody>
                        {last25Starts.map((start, idx) => {
                          const formatSG = (val: number | null) => {
                            if (val === null) return '-';
                            return val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
                          };
                          const sgColor = (val: number | null) => {
                            if (val === null) return 'text-casino-gray';
                            return val >= 0 ? 'text-casino-green' : 'text-red-400';
                          };
                          return (
                            <tr key={idx} className="border-b border-casino-gold/10 hover:bg-casino-dark/30">
                              <td className="px-2 py-1 text-casino-text text-xs truncate max-w-[140px]">{start.tournament}</td>
                              <td className="px-2 py-1 text-center text-casino-gray text-xs whitespace-nowrap">{start.date}</td>
                              <td className="px-2 py-1 text-center">
                                <span className={`font-semibold text-xs ${
                                  start.position === 'MC' ? 'text-red-400' :
                                  start.position === '-' ? 'text-casino-gray' :
                                  parseInt(start.position.replace('T', '')) <= 10 ? 'text-casino-green' :
                                  'text-casino-text'
                                }`}>
                                  {start.position}
                                </span>
                              </td>
                              <td className="px-2 py-1 text-center text-casino-gray text-xs">{start.score}</td>
                              <td className={`hidden md:table-cell px-1.5 py-1 text-center text-xs ${sgColor(start.sg_off_tee)}`}>{formatSG(start.sg_off_tee)}</td>
                              <td className={`hidden md:table-cell px-1.5 py-1 text-center text-xs ${sgColor(start.sg_approach)}`}>{formatSG(start.sg_approach)}</td>
                              <td className={`hidden md:table-cell px-1.5 py-1 text-center text-xs ${sgColor(start.sg_around_green)}`}>{formatSG(start.sg_around_green)}</td>
                              <td className={`hidden md:table-cell px-1.5 py-1 text-center text-xs ${sgColor(start.sg_putting)}`}>{formatSG(start.sg_putting)}</td>
                              <td className={`px-1.5 py-1 text-center text-xs font-medium ${sgColor(start.sg_total)}`}>{formatSG(start.sg_total)}</td>
                            </tr>
                          );
                        })}
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
    </div>,
    document.body
  );
}
