'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { formatScore, getScoreColor } from '@/lib/utils';

interface Hole {
  holeNumber: number | string;
  par: number | string;
  strokes: number | string;
  scoreToPar: number;
}

interface Round {
  roundNumber: number | string;
  courseName: string;
  scoreToPar: string;
  strokes: number | string;
  holes: Hole[];
  roundComplete?: boolean;
}

interface Scorecard {
  player: {
    id: string;
    firstName: string;
    lastName: string;
    country: string;
  };
  tournament: {
    name: string;
    courseName: string;
  };
  rounds: Round[];
  currentRound: number;
  totalScore: string;
}

interface ScorecardModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
  playerName: string;
  eventId: string; // This is the tournId (e.g., "004")
  year?: string; // Tournament year, defaults to current year
}

// Helper to parse score string like "-9", "+2", "E"
function parseScoreString(score: string | number | null): number {
  if (score === null || score === undefined) return 0;
  if (typeof score === 'number') return score;
  if (score === 'E') return 0;
  const s = score.toString().trim();
  if (s.startsWith('+')) return parseInt(s.slice(1), 10) || 0;
  if (s.startsWith('-')) return parseInt(s, 10) || 0;
  return parseInt(s, 10) || 0;
}

// Component for traditional golf score display with circles and squares
function HoleScore({ strokes, scoreToPar }: { strokes: number | string; scoreToPar: number }) {
  const score = Number(strokes);
  
  if (scoreToPar <= -2) {
    // Eagle or better - double circle
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 relative">
        <span className="absolute inset-0 rounded-full border-2 border-casino-gold" />
        <span className="absolute inset-0.5 rounded-full border-2 border-casino-gold" />
        <span className="text-casino-gold font-bold text-sm">{score}</span>
      </span>
    );
  }
  
  if (scoreToPar === -1) {
    // Birdie - single circle
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-red-500">
        <span className="text-red-500 font-semibold text-sm">{score}</span>
      </span>
    );
  }
  
  if (scoreToPar === 0) {
    // Par - no decoration
    return (
      <span className="inline-flex items-center justify-center w-7 h-7">
        <span className="text-casino-text text-sm">{score}</span>
      </span>
    );
  }
  
  if (scoreToPar === 1) {
    // Bogey - single square
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 border-2 border-blue-400">
        <span className="text-blue-400 font-semibold text-sm">{score}</span>
      </span>
    );
  }
  
  // Double bogey or worse - double square
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 relative">
      <span className="absolute inset-0 border-2 border-blue-600" />
      <span className="absolute inset-0.5 border-2 border-blue-600" />
      <span className="text-blue-600 font-bold text-sm">{score}</span>
    </span>
  );
}

export function ScorecardModal({ isOpen, onClose, playerId, playerName, eventId, year }: ScorecardModalProps) {
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  // Use provided year or default to current year
  const tournamentYear = year || new Date().getFullYear().toString();

  const fetchScorecard = useCallback(async () => {
    if (!playerId || !eventId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/scores/scorecard?year=${tournamentYear}&tournId=${eventId}&playerId=${playerId}`);
      const result = await response.json();
      
      if (!response.ok || !result.data) {
        setError(result.error || 'Failed to load scorecard');
        return;
      }
      
      setScorecard(result.data);
      // Default to latest round
      if (result.data.rounds?.length > 0) {
        const latestRound = result.data.rounds[result.data.rounds.length - 1];
        setSelectedRound(Number(latestRound.roundNumber));
      } else if (result.data.currentRound) {
        setSelectedRound(Number(result.data.currentRound));
      }
    } catch (err) {
      setError('Network error - unable to load scorecard');
    } finally {
      setIsLoading(false);
    }
  }, [playerId, eventId, tournamentYear]);

  useEffect(() => {
    if (isOpen && playerId) {
      fetchScorecard();
    }
  }, [isOpen, playerId, fetchScorecard]);

  // Close on escape key and lock body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      // Lock body scroll when modal is open
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentRoundData = scorecard?.rounds?.find(r => Number(r.roundNumber) === selectedRound);
  
  // Split holes into front 9 and back 9
  const frontNine = currentRoundData?.holes?.filter(h => Number(h.holeNumber) <= 9) || [];
  const backNine = currentRoundData?.holes?.filter(h => Number(h.holeNumber) > 9) || [];
  
  // Calculate totals
  const frontNinePar = frontNine.reduce((sum, h) => sum + Number(h.par), 0);
  const frontNineStrokes = frontNine.reduce((sum, h) => sum + Number(h.strokes), 0);
  const backNinePar = backNine.reduce((sum, h) => sum + Number(h.par), 0);
  const backNineStrokes = backNine.reduce((sum, h) => sum + Number(h.strokes), 0);

  // Use portal to render modal at document body level
  const modalContent = (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
      {/* Backdrop - covers entire screen */}
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
      
      {/* Modal - centered on screen */}
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
        <div className="flex items-center justify-between p-4 border-b border-casino-gold/20">
          <div>
            <h2 className="text-lg font-bold text-casino-gold">{playerName}</h2>
            {scorecard && (
              <p className="text-xs text-casino-gray">
                Total: <span className={getScoreColor(parseScoreString(scorecard.totalScore))}>{scorecard.totalScore}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-casino-elevated rounded-lg transition-colors text-casino-gray hover:text-casino-text"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="animate-spin text-2xl">🔄</span>
              <span className="ml-2 text-casino-gray">Loading scorecard...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400">{error}</p>
              <button 
                onClick={fetchScorecard}
                className="mt-4 px-4 py-2 bg-casino-gold/20 hover:bg-casino-gold/30 text-casino-gold rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          ) : scorecard ? (
            <>
              {/* Round selector */}
              {scorecard.rounds.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {scorecard.rounds.map(round => {
                    const roundNum = Number(round.roundNumber);
                    const scoreNum = parseScoreString(round.scoreToPar);
                    return (
                      <button
                        key={roundNum}
                        onClick={() => setSelectedRound(roundNum)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          selectedRound === roundNum
                            ? 'bg-casino-gold text-black font-medium'
                            : 'bg-casino-elevated text-casino-gray hover:text-casino-text'
                        }`}
                      >
                        R{roundNum}
                        <span className={`ml-1 ${getScoreColor(scoreNum)}`}>
                          ({formatScore(scoreNum)})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentRoundData && currentRoundData.holes.length > 0 ? (
                <div className="space-y-4">
                  {/* Course name */}
                  <p className="text-xs text-casino-gray text-center">{currentRoundData.courseName}</p>
                  
                  {/* Front 9 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-casino-gray">
                          <th className="px-1 py-1 text-left">Hole</th>
                          {frontNine.map(h => (
                            <th key={h.holeNumber} className="px-1 py-1 w-8 text-center">{h.holeNumber}</th>
                          ))}
                          <th className="px-1 py-1 w-10 text-center bg-casino-elevated">OUT</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="text-casino-gray border-b border-casino-gold/10">
                          <td className="px-1 py-1 text-left">Par</td>
                          {frontNine.map(h => (
                            <td key={h.holeNumber} className="px-1 py-1 text-center">{h.par}</td>
                          ))}
                          <td className="px-1 py-1 text-center bg-casino-elevated font-medium">{frontNinePar}</td>
                        </tr>
                        <tr>
                          <td className="px-1 py-1 text-left text-casino-text font-medium">Score</td>
                          {frontNine.map(h => (
                            <td key={h.holeNumber} className="px-1 py-1 text-center">
                              <HoleScore strokes={h.strokes} scoreToPar={h.scoreToPar} />
                            </td>
                          ))}
                          <td className="px-1 py-1 text-center bg-casino-elevated">
                            <span className="font-bold text-casino-text">{frontNineStrokes}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Back 9 */}
                  {backNine.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-casino-gray">
                            <th className="px-1 py-1 text-left">Hole</th>
                            {backNine.map(h => (
                              <th key={h.holeNumber} className="px-1 py-1 w-8 text-center">{h.holeNumber}</th>
                            ))}
                            <th className="px-1 py-1 w-10 text-center bg-casino-elevated">IN</th>
                            <th className="px-1 py-1 w-10 text-center bg-casino-gold/20">TOT</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="text-casino-gray border-b border-casino-gold/10">
                            <td className="px-1 py-1 text-left">Par</td>
                            {backNine.map(h => (
                              <td key={h.holeNumber} className="px-1 py-1 text-center">{h.par}</td>
                            ))}
                            <td className="px-1 py-1 text-center bg-casino-elevated font-medium">{backNinePar}</td>
                            <td className="px-1 py-1 text-center bg-casino-gold/20 font-medium">{frontNinePar + backNinePar}</td>
                          </tr>
                          <tr>
                            <td className="px-1 py-1 text-left text-casino-text font-medium">Score</td>
                            {backNine.map(h => (
                              <td key={h.holeNumber} className="px-1 py-1 text-center">
                                <HoleScore strokes={h.strokes} scoreToPar={h.scoreToPar} />
                              </td>
                            ))}
                            <td className="px-1 py-1 text-center bg-casino-elevated">
                              <span className="font-bold text-casino-text">{backNineStrokes}</span>
                            </td>
                            <td className="px-1 py-1 text-center bg-casino-gold/20">
                              <span className="font-bold text-casino-gold">{frontNineStrokes + backNineStrokes}</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 justify-center pt-4 border-t border-casino-gold/10 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 relative">
                        <span className="absolute inset-0 rounded-full border-2 border-casino-gold" />
                        <span className="absolute inset-0.5 rounded-full border-2 border-casino-gold" />
                      </span>
                      <span className="text-casino-gray">Eagle+</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-red-500" />
                      <span className="text-casino-gray">Birdie</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 text-casino-text text-xs">4</span>
                      <span className="text-casino-gray">Par</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 border-2 border-blue-400" />
                      <span className="text-casino-gray">Bogey</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 relative">
                        <span className="absolute inset-0 border-2 border-blue-600" />
                        <span className="absolute inset-0.5 border-2 border-blue-600" />
                      </span>
                      <span className="text-casino-gray">Double+</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-casino-gray py-8">No scorecard data available for this round.</p>
              )}
            </>
          ) : (
            <p className="text-center text-casino-gray py-8">No scorecard data available.</p>
          )}
        </div>
      </div>
    </div>
  );

  // Render modal at document body level using portal
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  
  return modalContent;
}
