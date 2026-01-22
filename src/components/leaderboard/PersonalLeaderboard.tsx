'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RosterWithDetails } from '@/lib/types';
import { PlayerRow } from './PlayerRow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface PersonalLeaderboardProps {
  rosterId: string;
  initialRoster?: RosterWithDetails;
}

export function PersonalLeaderboard({
  rosterId,
  initialRoster,
}: PersonalLeaderboardProps) {
  const [roster, setRoster] = useState<RosterWithDetails | null>(
    initialRoster || null
  );
  const [isLoading, setIsLoading] = useState(!initialRoster);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialRoster) {
      loadRoster();
    }

    // Subscribe to real-time updates
    const supabase = createClient();
    const channel = supabase
      .channel(`roster-${rosterId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'roster_players',
          filter: `roster_id=eq.${rosterId}`,
        },
        () => {
          loadRoster();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_players',
        },
        () => {
          loadRoster();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rosterId, initialRoster]);

  async function loadRoster() {
    try {
      setIsLoading(true);
      const supabase = createClient();

      // Get roster with details
      const { data: rosterData, error: rosterError } = await supabase
        .from('user_rosters')
        .select(
          `
          *,
          tournament:tournaments(*),
          roster_players(
            *,
            tournament_player:tournament_players(
              *,
              pga_player:pga_players(*)
            )
          )
        `
        )
        .eq('id', rosterId)
        .single();

      if (rosterError) throw rosterError;

      // Sort roster players by winnings (descending), then by fantasy points as tiebreaker
      const sortedRoster = {
        ...rosterData,
        roster_players: (rosterData.roster_players || [])
          .map((rp: any) => ({
            ...rp,
            tournament_player: rp.tournament_player || {},
          }))
          .sort((a: any, b: any) => {
            const aWinnings = a.player_winnings || 0;
            const bWinnings = b.player_winnings || 0;
            if (aWinnings !== bWinnings) {
              return bWinnings - aWinnings;
            }
            return (b.fantasy_points || 0) - (a.fantasy_points || 0);
          }),
      };

      setRoster(sortedRoster as RosterWithDetails);
    } catch (err: any) {
      setError(err.message || 'Failed to load roster');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !roster) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-red-600">
            {error || 'Roster not found'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalWinnings = roster.total_winnings || roster.roster_players?.reduce(
    (sum, rp) => sum + (rp.player_winnings || 0),
    0
  ) || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex-1">
            <CardTitle className="text-lg sm:text-xl">{roster.roster_name}</CardTitle>
            {roster.tournament && (
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {roster.tournament.name}
              </p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs sm:text-sm text-gray-600">Total Winnings</p>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">
              ${totalWinnings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pos
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  Today
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Thru
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prize
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  Cut
                </th>
              </tr>
            </thead>
            <tbody>
              {roster.roster_players && roster.roster_players.length > 0 ? (
                roster.roster_players.map((rp, index) => {
                  if (!rp.tournament_player) return null;
                  return (
                    <PlayerRow
                      key={rp.id}
                      player={rp.tournament_player}
                      playerWinnings={rp.player_winnings || 0}
                      rank={index + 1}
                    />
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No players in this roster yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
