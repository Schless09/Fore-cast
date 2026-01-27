'use client';

import { useState } from 'react';
import { TournamentPlayer, PGAPlayer } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { useParams } from 'next/navigation';
import { PlayerDetailsModal } from './PlayerDetailsModal';

// Convert country code to flag emoji
function getCountryFlag(countryCode: string | null): string {
  if (!countryCode) return '';
  
  // Convert 3-letter codes to 2-letter ISO codes
  const countryMap: Record<string, string> = {
    'USA': 'US', 'GBR': 'GB', 'CAN': 'CA', 'AUS': 'AU', 'JPN': 'JP',
    'KOR': 'KR', 'CHN': 'CN', 'MEX': 'MX', 'ESP': 'ES', 'FRA': 'FR',
    'GER': 'DE', 'ITA': 'IT', 'SWE': 'SE', 'NOR': 'NO', 'DEN': 'DK',
    'FIN': 'FI', 'IRL': 'IE', 'SCO': 'GB', 'ENG': 'GB', 'WAL': 'GB',
    'NIR': 'GB', 'ARG': 'AR', 'BRA': 'BR', 'CHI': 'CL', 'COL': 'CO',
    'RSA': 'ZA', 'NZL': 'NZ', 'IND': 'IN', 'THA': 'TH', 'PHI': 'PH',
    'TAI': 'TW', 'VEN': 'VE',
  };

  const code = countryCode.toUpperCase();
  const twoLetterCode = countryMap[code] || code.substring(0, 2);
  
  const codePoints = twoLetterCode
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

interface PlayerSelectorProps {
  tournamentPlayers: (TournamentPlayer & { pga_player?: PGAPlayer; pga_players?: PGAPlayer })[];
  selectedPlayerIds: string[];
  onTogglePlayer: (playerId: string) => void;
  maxPlayers: number;
  budgetLimit: number;
  budgetSpent: number;
  isLoading?: boolean;
  tournamentId?: string;
  venueId?: string;
  tournamentName?: string;
}

export function PlayerSelector({
  tournamentPlayers,
  selectedPlayerIds,
  onTogglePlayer,
  maxPlayers,
  budgetLimit,
  budgetSpent,
  isLoading = false,
  tournamentId,
  venueId,
  tournamentName,
}: PlayerSelectorProps) {
  const [selectedPlayerForDetails, setSelectedPlayerForDetails] = useState<{
    player: PGAPlayer;
    cost: number;
  } | null>(null);

  const canAddMore = selectedPlayerIds.length < maxPlayers;
  const remainingBudget = budgetLimit - budgetSpent;

  // Sort players by cost (descending) for better UX
  const sortedPlayers = [...tournamentPlayers].sort(
    (a, b) => (b.cost || 0) - (a.cost || 0)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Select Players ({selectedPlayerIds.length}/{maxPlayers})
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              Budget Spent: <span className="font-semibold text-gray-900">${budgetSpent.toFixed(2)}</span>
            </span>
            <span className="text-gray-600">
              Remaining: <span className={`font-semibold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${remainingBudget.toFixed(2)}
              </span>
            </span>
          </div>
        </div>
        {!canAddMore && (
          <span className="text-sm text-green-600 font-medium px-3 py-1 bg-green-50 rounded">
            Roster Complete
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Loading players...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Group players into sections of 30 */}
          {Array.from({ length: Math.ceil(sortedPlayers.length / 30) }, (_, sectionIdx) => {
            const startIdx = sectionIdx * 30;
            const endIdx = Math.min(startIdx + 30, sortedPlayers.length);
            const sectionPlayers = sortedPlayers.slice(startIdx, endIdx);
            
            // Split into 3 columns of 10
            const columns = [
              sectionPlayers.slice(0, 10),
              sectionPlayers.slice(10, 20),
              sectionPlayers.slice(20, 30),
            ].filter(col => col.length > 0);

            return (
              <div key={sectionIdx} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Players {startIdx + 1} - {endIdx}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {columns.map((column, colIdx) => (
                    <div key={colIdx} className="space-y-1">
                      {column.map((tp, rowIdx) => {
                        const pgaPlayer = tp.pga_player || (tp as any).pga_players;
                        if (!pgaPlayer) return null;

                        const playerId = tp.pga_player_id;
                        const isSelected = selectedPlayerIds.includes(playerId);
                        const cost = tp.cost || 0.20;
                        const wouldExceedBudget = !isSelected && (cost > remainingBudget);
                        const wouldExceedMax = !isSelected && !canAddMore;
                        const isDisabled = wouldExceedBudget || wouldExceedMax;
                        const rank = startIdx + (colIdx * 10) + rowIdx + 1;

                        return (
                          <div
                            key={tp.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded border transition-all text-sm ${
                              isSelected
                                ? 'border-green-600 bg-green-50 ring-1 ring-green-600'
                                : isDisabled
                                ? 'border-gray-200 bg-gray-50 opacity-50'
                                : 'border-gray-200 hover:border-green-400 hover:bg-gray-50'
                            }`}
                          >
                            {/* Info button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPlayerForDetails({ player: pgaPlayer, cost });
                              }}
                              className="text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0"
                              title="View player details"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            
                            {/* Clickable area for selection */}
                            <div
                              className={`flex-1 flex items-center gap-2 min-w-0 ${
                                isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                              }`}
                              onClick={() => !isDisabled && onTogglePlayer(playerId)}
                            >
                              <div className="text-xs text-gray-400 w-5 text-right flex-shrink-0">
                                {rank}
                              </div>
                              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                <span className="truncate font-medium text-gray-900">
                                  {pgaPlayer.name}
                                </span>
                                {pgaPlayer.country && (
                                  <span className="text-xs flex-shrink-0" title={pgaPlayer.country}>
                                    {getCountryFlag(pgaPlayer.country)}
                                  </span>
                                )}
                              </div>
                              <div className={`text-xs font-bold flex-shrink-0 ${
                                cost >= 10 ? 'text-red-600' : 
                                cost >= 5 ? 'text-orange-600' : 
                                cost >= 2 ? 'text-yellow-600' : 
                                'text-gray-600'
                              }`}>
                                ${cost.toFixed(2)}
                              </div>
                              {isSelected && (
                                <div className="text-green-600 font-bold flex-shrink-0">✓</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Player Details Modal */}
      {selectedPlayerForDetails && (
        <PlayerDetailsModal
          player={selectedPlayerForDetails.player}
          cost={selectedPlayerForDetails.cost}
          isOpen={!!selectedPlayerForDetails}
          onClose={() => setSelectedPlayerForDetails(null)}
          tournamentName={tournamentName}
          venueId={venueId}
        />
      )}
    </div>
  );
}
