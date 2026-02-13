'use client';

import { useState } from 'react';
import { ScorecardModal } from '@/components/leaderboard/ScorecardModal';

interface CachedPlayer {
  player?: string;
  playerId?: string;
  position?: string;
  positionValue?: number;
  total?: string | number;
  thru?: string;
  currentRoundScore?: string | number;
}

interface ESPNCompareTableProps {
  players: CachedPlayer[];
  updatedAt: string | null;
  espnEventId: string | null;
}

export function ESPNCompareTable({ players, updatedAt, espnEventId }: ESPNCompareTableProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);

  const canShowScorecard = Boolean(espnEventId);

  return (
    <>
      <div className="bg-casino-card border border-casino-gold/20 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-casino-gold mb-2">ESPN (espn_cache)</h2>
        <p className="text-xs text-casino-gray mb-4">
          Updated: {updatedAt ? new Date(updatedAt).toLocaleString() : 'never'}
        </p>
        <p className="text-sm text-casino-gray mb-2">{players.length} players</p>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Total</th>
                <th className="px-2 py-2" title={canShowScorecard ? 'Click score to view scorecard' : undefined}>
                  Today
                </th>
                <th className="px-2 py-2">Thru</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={i} className="border-b border-casino-gold/10">
                  <td className="px-2 py-1.5">{p.positionValue ?? p.position ?? '-'}</td>
                  <td className="px-2 py-1.5">{p.player ?? 'Unknown'}</td>
                  <td className="px-2 py-1.5">{String(p.total ?? '-')}</td>
                  <td className="px-2 py-1.5">
                    {canShowScorecard && p.playerId && p.currentRoundScore != null ? (
                      <button
                        onClick={() => setSelectedPlayer({ id: p.playerId!, name: p.player ?? 'Unknown' })}
                        className="hover:underline hover:text-casino-gold transition-colors cursor-pointer text-left"
                        title="Click to view scorecard"
                      >
                        {String(p.currentRoundScore)}
                      </button>
                    ) : (
                      p.currentRoundScore != null ? String(p.currentRoundScore) : '-'
                    )}
                  </td>
                  <td className="px-2 py-1.5">{p.thru ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {canShowScorecard && espnEventId && (
        <ScorecardModal
          isOpen={selectedPlayer !== null}
          onClose={() => setSelectedPlayer(null)}
          playerId={selectedPlayer?.id ?? ''}
          playerName={selectedPlayer?.name ?? ''}
          eventId={espnEventId}
          source="espn"
        />
      )}
    </>
  );
}
