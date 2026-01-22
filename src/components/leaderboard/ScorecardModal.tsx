'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ScorecardModalProps {
  player: {
    name: string;
    position: number | null;
    total_score: number;
    today_score: number;
    thru: string | number;
    prize_money: number;
  };
  tournamentId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ScorecardData {
  player: string;
  position: number | null;
  total: number;
  thru: string;
  round: number;
  scores: Array<{
    hole: number;
    par: number;
    score: number;
    yardage?: number;
  }>;
}

export function ScorecardModal({ player, tournamentId, isOpen, onClose }: ScorecardModalProps) {
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && player) {
      fetchScorecard();
    }
  }, [isOpen, player]);

  const fetchScorecard = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Get the player's tournament_player record to find their scorecard data
      const { data: tournamentPlayer, error } = await supabase
        .from('tournament_players')
        .select(`
          id,
          position,
          total_score,
          thru,
          tee_time,
          pga_players!inner(name)
        `)
        .eq('tournament_id', tournamentId)
        .eq('pga_players.name', player.name)
        .single();

      if (error || !tournamentPlayer) {
        throw new Error('Player data not found');
      }

      // For now, create a structured scorecard from available data
      // In a full implementation, this would fetch detailed hole-by-hole data from LiveGolfAPI
      const scorecardData: ScorecardData = {
        player: tournamentPlayer.pga_players.name,
        position: tournamentPlayer.position,
        total: tournamentPlayer.total_score,
        thru: String(tournamentPlayer.thru || 0),
        round: 1,
        scores: [] // Would be populated with real hole data from API
      };

      // If player has completed holes, show them
      const holesCompleted = parseInt(String(tournamentPlayer.thru)) || 0;
      if (holesCompleted > 0) {
        // Mock hole-by-hole data - in real implementation, this comes from LiveGolfAPI
        scorecardData.scores = Array.from({ length: Math.min(holesCompleted, 18) }, (_, i) => ({
          hole: i + 1,
          par: 4, // Standard par 4 - would come from course data
          score: Math.floor(Math.random() * 3) + 3, // Would come from API
          yardage: Math.floor(Math.random() * 200) + 420, // Would come from course data
        }));
      }

      setScorecard(scorecardData);
    } catch (err) {
      setError('Failed to load scorecard');
      console.error('Error fetching scorecard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-casino-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-casino-gold/20">
          <div>
            <h2 className="text-xl font-bold text-casino-text">{player.name}</h2>
            <p className="text-casino-gray text-sm">
              Round 1 • Thru {player.thru} • {player.position ? `T${player.position}` : 'Position TBD'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-casino-gray hover:text-casino-text transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-casino-gold"></div>
              <span className="ml-3 text-casino-gray">Loading scorecard...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-casino-red">{error}</p>
            </div>
          )}

          {scorecard && (
            <div className="space-y-6">
              {/* Score Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-casino-elevated p-4 rounded-lg text-center">
                  <p className="text-casino-gray text-sm">Total Score</p>
                  <p className={`text-2xl font-bold ${player.total_score <= 0 ? 'text-casino-green' : 'text-casino-red'}`}>
                    {player.total_score > 0 ? '+' : ''}{player.total_score}
                  </p>
                </div>
                <div className="bg-casino-elevated p-4 rounded-lg text-center">
                  <p className="text-casino-gray text-sm">Today's Score</p>
                  <p className={`text-2xl font-bold ${player.today_score <= 0 ? 'text-casino-green' : 'text-casino-red'}`}>
                    {player.today_score > 0 ? '+' : ''}{player.today_score}
                  </p>
                </div>
                <div className="bg-casino-elevated p-4 rounded-lg text-center">
                  <p className="text-casino-gray text-sm">Position</p>
                  <p className="text-2xl font-bold text-casino-gold">
                    {player.position ? `${player.position === 1 ? '' : 'T'}${player.position}` : 'N/A'}
                  </p>
                </div>
                <div className="bg-casino-elevated p-4 rounded-lg text-center">
                  <p className="text-casino-gray text-sm">Prize Money</p>
                  <p className="text-2xl font-bold text-casino-green">
                    ${player.prize_money?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>

              {/* Scorecard Status */}
              <div className="bg-casino-elevated p-4 rounded-lg">
                <div className="flex items-center justify-center space-x-2 text-casino-gray">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Detailed hole-by-hole scorecard data coming soon!</span>
                </div>
                <p className="text-center text-sm text-casino-gray mt-2">
                  Currently showing round summary. Full scorecard integration with LiveGolfAPI in progress.
                </p>
              </div>

              {/* Current Round Progress */}
              {parseInt(scorecard.thru) > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-casino-text mb-4">Round Progress</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-casino-elevated p-3 rounded-lg text-center">
                      <p className="text-casino-gray text-xs">Holes Completed</p>
                      <p className="text-xl font-bold text-casino-gold">{scorecard.thru}</p>
                    </div>
                    <div className="bg-casino-elevated p-3 rounded-lg text-center">
                      <p className="text-casino-gray text-xs">Holes Remaining</p>
                      <p className="text-xl font-bold text-casino-text">{18 - parseInt(scorecard.thru)}</p>
                    </div>
                    <div className="bg-casino-elevated p-3 rounded-lg text-center">
                      <p className="text-casino-gray text-xs">Round Status</p>
                      <p className="text-sm font-medium text-casino-green">
                        {parseInt(scorecard.thru) === 18 ? 'Completed' : 'In Progress'}
                      </p>
                    </div>
                    <div className="bg-casino-elevated p-3 rounded-lg text-center">
                      <p className="text-casino-gray text-xs">Pace</p>
                      <p className="text-sm font-medium text-casino-text">
                        {parseInt(scorecard.thru) > 0 ? `${(parseInt(scorecard.thru) / 18 * 100).toFixed(0)}%` : 'Not Started'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}