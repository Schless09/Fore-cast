'use client';

import { PGAPlayer } from '@/lib/types';

interface TournamentHistory {
  year: number;
  position: string;
  score: string;
  earnings: number;
}

interface RecentStart {
  tournament: string;
  date: string;
  position: string;
  score: string;
}

interface PlayerDetailsModalProps {
  player: PGAPlayer;
  cost: number;
  isOpen: boolean;
  onClose: () => void;
  tournamentName?: string;
}

// Generate fake tournament history for this venue
function generateFakeTournamentHistory(playerName: string): TournamentHistory[] {
  // Use player name to seed somewhat consistent fake data
  const seed = playerName.length;
  const years = [2025, 2024, 2023, 2022, 2021];
  
  return years.map((year, idx) => {
    const didPlay = (seed + idx) % 3 !== 0; // Some years they didn't play
    if (!didPlay && idx > 0) return null;
    
    const positionNum = Math.floor((seed * (idx + 1)) % 60) + 1;
    const position = positionNum <= 10 ? `T${positionNum}` : 
                     positionNum <= 30 ? `${positionNum}` : 
                     positionNum <= 50 ? `T${positionNum}` : 'MC';
    
    const score = position === 'MC' ? '+8' : 
                  positionNum <= 5 ? `-${14 - positionNum}` :
                  positionNum <= 15 ? `-${8 - Math.floor(positionNum / 3)}` :
                  positionNum <= 30 ? `${positionNum % 5 === 0 ? 'E' : `-${3 - Math.floor(positionNum / 15)}`}` :
                  `+${Math.floor(positionNum / 20)}`;
    
    const earnings = position === 'MC' ? 0 :
                     positionNum === 1 ? 3600000 :
                     positionNum <= 5 ? 1200000 - (positionNum * 150000) :
                     positionNum <= 10 ? 400000 - (positionNum * 25000) :
                     positionNum <= 30 ? 150000 - (positionNum * 3000) :
                     50000 - (positionNum * 500);

    return { year, position, score, earnings: Math.max(0, earnings) };
  }).filter(Boolean) as TournamentHistory[];
}

// Generate fake last 25 starts
function generateFakeLast25Starts(playerName: string): RecentStart[] {
  const tournaments = [
    'Sony Open', 'American Express', 'Farmers Insurance Open', 'AT&T Pebble Beach',
    'WM Phoenix Open', 'Genesis Invitational', 'Mexico Open', 'Arnold Palmer Invitational',
    'THE PLAYERS', 'Valspar Championship', 'Texas Children\'s Houston Open', 'Valero Texas Open',
    'Masters Tournament', 'RBC Heritage', 'Zurich Classic', 'Wells Fargo Championship',
    'PGA Championship', 'Charles Schwab Challenge', 'Memorial Tournament', 'U.S. Open',
    'Travelers Championship', 'Rocket Mortgage Classic', 'John Deere Classic', 'Scottish Open',
    'The Open Championship'
  ];

  const seed = playerName.length;
  
  return tournaments.slice(0, 25).map((tournament, idx) => {
    const didPlay = (seed + idx) % 5 !== 0;
    if (!didPlay) {
      return {
        tournament,
        date: `2025`,
        position: 'WD',
        score: '-',
      };
    }

    const positionNum = Math.floor((seed * (idx + 2)) % 70) + 1;
    const position = positionNum <= 50 
      ? (positionNum <= 10 ? `T${positionNum}` : `${positionNum}`)
      : 'MC';
    
    const score = position === 'MC' ? '+6' :
                  position === 'WD' ? '-' :
                  positionNum <= 5 ? `-${16 - positionNum}` :
                  positionNum <= 20 ? `-${10 - Math.floor(positionNum / 3)}` :
                  `${positionNum > 40 ? '+' : '-'}${Math.abs(5 - Math.floor(positionNum / 10))}`;

    return { tournament, date: '2025', position, score };
  });
}

// Calculate stats from recent starts
function calculateStats(starts: RecentStart[]) {
  const finishes = starts.filter(s => s.position !== 'MC' && s.position !== 'WD');
  const cuts = starts.filter(s => s.position === 'MC').length;
  const top10s = finishes.filter(s => {
    const pos = parseInt(s.position.replace('T', ''));
    return !isNaN(pos) && pos <= 10;
  }).length;
  const top25s = finishes.filter(s => {
    const pos = parseInt(s.position.replace('T', ''));
    return !isNaN(pos) && pos <= 25;
  }).length;
  
  const avgFinish = finishes.length > 0
    ? finishes.reduce((sum, s) => {
        const pos = parseInt(s.position.replace('T', ''));
        return sum + (isNaN(pos) ? 50 : pos);
      }, 0) / finishes.length
    : 0;

  return {
    starts: starts.length,
    cuts,
    madeCuts: starts.length - cuts - starts.filter(s => s.position === 'WD').length,
    top10s,
    top25s,
    avgFinish: avgFinish.toFixed(1),
  };
}

export function PlayerDetailsModal({
  player,
  cost,
  isOpen,
  onClose,
  tournamentName = 'This Tournament',
}: PlayerDetailsModalProps) {
  if (!isOpen) return null;

  const tournamentHistory = generateFakeTournamentHistory(player.name);
  const last25Starts = generateFakeLast25Starts(player.name);
  const stats = calculateStats(last25Starts);

  // Use real data if available, otherwise fake it
  const worldRanking = player.world_ranking || Math.floor(player.name.length * 7) + 1;
  const fedexRanking = player.fedex_cup_ranking || (worldRanking <= 125 ? worldRanking + Math.floor(Math.random() * 20) : null);

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
                #{worldRanking}
              </div>
            </div>
            <div className="bg-casino-dark/50 rounded-lg p-4 border border-casino-gold/10">
              <div className="text-xs text-casino-gray uppercase tracking-wide mb-1">FedEx Cup Rank</div>
              <div className="text-3xl font-bold text-casino-green font-orbitron">
                {fedexRanking ? `#${fedexRanking}` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Last 25 Starts Stats */}
          <div>
            <h3 className="text-sm font-semibold text-casino-gold mb-3 flex items-center gap-2">
              <span>📊</span> Last 25 Starts Summary
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
                <div className="text-lg font-bold text-red-400">{stats.cuts}</div>
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
          </div>

          {/* Tournament History */}
          <div>
            <h3 className="text-sm font-semibold text-casino-gold mb-3 flex items-center gap-2">
              <span>🏌️</span> History at {tournamentName}
            </h3>
            {tournamentHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-casino-gold/20">
                      <th className="px-3 py-2 text-left text-xs font-medium text-casino-gray uppercase">Year</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-casino-gray uppercase">Finish</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-casino-gray uppercase">Score</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-casino-gray uppercase">Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournamentHistory.map((history, idx) => (
                      <tr key={idx} className="border-b border-casino-gold/10 hover:bg-casino-dark/30">
                        <td className="px-3 py-2 text-casino-text">{history.year}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-semibold ${
                            history.position === 'MC' ? 'text-red-400' :
                            history.position.includes('1') && !history.position.includes('T1') ? 'text-casino-gold' :
                            parseInt(history.position.replace('T', '')) <= 10 ? 'text-casino-green' :
                            'text-casino-text'
                          }`}>
                            {history.position}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-casino-gray">{history.score}</td>
                        <td className="px-3 py-2 text-right text-casino-green">
                          {history.earnings > 0 ? `$${history.earnings.toLocaleString()}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-casino-gray text-sm">No history at this tournament</p>
            )}
          </div>

          {/* Recent Form - Last 10 */}
          <div>
            <h3 className="text-sm font-semibold text-casino-gold mb-3 flex items-center gap-2">
              <span>📈</span> Recent Form (Last 10 Starts)
            </h3>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {last25Starts.slice(0, 10).map((start, idx) => (
                <div
                  key={idx}
                  className="bg-casino-dark/30 rounded-lg p-2 text-center border border-casino-gold/10"
                  title={`${start.tournament}: ${start.position}`}
                >
                  <div className={`text-sm font-bold ${
                    start.position === 'MC' ? 'text-red-400' :
                    start.position === 'WD' ? 'text-casino-gray' :
                    parseInt(start.position.replace('T', '')) <= 10 ? 'text-casino-green' :
                    parseInt(start.position.replace('T', '')) <= 25 ? 'text-casino-gold' :
                    'text-casino-text'
                  }`}>
                    {start.position}
                  </div>
                  <div className="text-xs text-casino-gray truncate" title={start.tournament}>
                    {start.tournament.split(' ')[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Last 25 Starts Table (Collapsible) */}
          <details className="group">
            <summary className="text-sm font-semibold text-casino-gold mb-3 flex items-center gap-2 cursor-pointer hover:text-casino-gold/80">
              <span>📋</span> All Last 25 Starts
              <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-casino-card">
                  <tr className="border-b border-casino-gold/20">
                    <th className="px-3 py-2 text-left text-xs font-medium text-casino-gray uppercase">Tournament</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-casino-gray uppercase">Finish</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-casino-gray uppercase">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {last25Starts.map((start, idx) => (
                    <tr key={idx} className="border-b border-casino-gold/10 hover:bg-casino-dark/30">
                      <td className="px-3 py-2 text-casino-text text-xs">{start.tournament}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-semibold text-xs ${
                          start.position === 'MC' ? 'text-red-400' :
                          start.position === 'WD' ? 'text-casino-gray' :
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
          </details>
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
