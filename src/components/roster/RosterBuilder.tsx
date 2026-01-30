'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { TournamentPlayer, PGAPlayer } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { PlayerSelector } from './PlayerSelector';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { calculateRosterCost, validateRoster } from '@/lib/salary-cap';

interface RosterBuilderProps {
  tournamentId: string;
  existingRoster?: {
    id: string;
    rosterName: string;
    playerIds: string[];
  };
  onSave?: () => void;
  tournamentStatus?: 'upcoming' | 'active' | 'completed';
}

const MAX_PLAYERS = 10;
const BUDGET_LIMIT = 30.00;

export function RosterBuilder({
  tournamentId,
  existingRoster,
  onSave,
  tournamentStatus,
}: RosterBuilderProps) {
  const router = useRouter();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const [tournamentPlayers, setTournamentPlayers] = useState<
    (TournamentPlayer & { pga_player?: PGAPlayer; pga_players?: PGAPlayer })[]
  >([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(
    existingRoster?.playerIds || []
  );
  const [username, setUsername] = useState<string>('');
  const [tournamentName, setTournamentName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedRosterId, setSubmittedRosterId] = useState<string | null>(null);

  // Set username from Clerk user
  useEffect(() => {
    if (clerkLoaded && clerkUser) {
      const displayName = clerkUser.username || 
        clerkUser.firstName || 
        clerkUser.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 
        'User';
      setUsername(displayName);
    }
  }, [clerkUser, clerkLoaded]);

  const loadTournamentPlayers = useCallback(async () => {
    try {
      const supabase = createClient();

      // Get tournament info for name
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('name')
        .eq('id', tournamentId)
        .single();

      if (tournamentData) {
        setTournamentName(tournamentData.name);
      }

      // Get tournament players with costs and player info
      const { data: tournamentPlayersData, error: tpError } = await supabase
        .from('tournament_players')
        .select(`
          *,
          pga_players(*)
        `)
        .eq('tournament_id', tournamentId)
        .order('cost', { ascending: false });

      if (tpError) throw tpError;

      setTournamentPlayers(tournamentPlayersData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players');
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    loadTournamentPlayers();
  }, [loadTournamentPlayers]);

  function handleTogglePlayer(playerId: string) {
    setSelectedPlayerIds((prev) => {
      if (prev.includes(playerId)) {
        // Remove player
        return prev.filter((id) => id !== playerId);
      } else {
        // Add player if under budget and max players
        const player = tournamentPlayers.find(
          (tp) => tp.pga_player_id === playerId
        );
        if (!player) return prev;

        const currentCosts = prev.map((id) => {
          const tp = tournamentPlayers.find((t) => t.pga_player_id === id);
          return tp?.cost || 0.20;
        });

        const newCosts = [...currentCosts, player.cost || 0.20];
        const validation = validateRoster(
          newCosts,
          BUDGET_LIMIT,
          MAX_PLAYERS
        );

        if (validation.valid) {
          return [...prev, playerId];
        } else {
          setError(validation.errors[0]);
          setTimeout(() => setError(null), 5000);
          return prev;
        }
      }
    });
  }

  function getBudgetSpent(): number {
    return calculateRosterCost(
      selectedPlayerIds.map((id) => {
        const tp = tournamentPlayers.find((t) => t.pga_player_id === id);
        return tp?.cost || 0.20;
      })
    );
  }

  async function handleSave() {
    // Check tournament status - only allow saves for upcoming tournaments
    if (tournamentStatus && tournamentStatus !== 'upcoming') {
      setError('Lineups are locked - the tournament has already started.');
      return;
    }

    if (!username.trim()) {
      setError('Unable to load username. Please refresh the page.');
      return;
    }

    if (!clerkUser) {
      setError('Please sign in to create a roster.');
      router.push('/auth');
      return;
    }

    const playerCosts = selectedPlayerIds.map((id) => {
      const tp = tournamentPlayers.find((t) => t.pga_player_id === id);
      return tp?.cost || 0.20;
    });

    const validation = validateRoster(playerCosts, BUDGET_LIMIT, MAX_PLAYERS);
    if (!validation.valid) {
      setError(validation.errors.join(' '));
      return;
    }

    if (selectedPlayerIds.length === 0) {
      setError('Please select at least one player');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const supabase = createClient();
      
      // Look up profile by Clerk ID
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('clerk_id', clerkUser.id)
        .single();

      if (profileError || !profile) {
        setError('Profile not found. Please try signing out and back in.');
        return;
      }

      const budgetSpent = calculateRosterCost(playerCosts);

      let rosterId: string;
      
      if (existingRoster) {
        // Update existing roster
        await updateRoster(existingRoster.id, budgetSpent);
        rosterId = existingRoster.id;
      } else {
        // Create new roster
        rosterId = await createRoster(profile.id, budgetSpent);
      }

      // Show success modal
      setSubmittedRosterId(rosterId);
      setShowSuccessModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save roster');
    } finally {
      setIsSaving(false);
    }
  }

  async function createRoster(profileId: string, budgetSpent: number): Promise<string> {
    const supabase = createClient();

    // Create roster with budget tracking (use username as roster name)
    const { data: roster, error: rosterError } = await supabase
      .from('user_rosters')
      .insert({
        user_id: profileId,
        tournament_id: tournamentId,
        roster_name: username,
        budget_spent: budgetSpent,
        budget_limit: BUDGET_LIMIT,
        max_players: MAX_PLAYERS,
      })
      .select()
      .single();

    if (rosterError) {
      // Check if error is due to unique constraint violation
      if (rosterError.code === '23505') {
        throw new Error('You already have a roster for this tournament. Please refresh the page.');
      }
      throw rosterError;
    }

    // Get tournament_player_ids for selected players
    const { data: tournamentPlayersData, error: tpError } = await supabase
      .from('tournament_players')
      .select('id, pga_player_id')
      .eq('tournament_id', tournamentId)
      .in('pga_player_id', selectedPlayerIds);

    if (tpError) throw tpError;

    // Add players to roster
    const rosterPlayers = tournamentPlayersData!.map((tp) => ({
      roster_id: roster.id,
      tournament_player_id: tp.id,
    }));

    const { error: rpError } = await supabase
      .from('roster_players')
      .insert(rosterPlayers);

    if (rpError) throw rpError;
    
    return roster.id;
  }

  async function updateRoster(rosterId: string, budgetSpent: number) {
    const supabase = createClient();

    // Update roster name and budget (use username as roster name)
    const { error: rosterError } = await supabase
      .from('user_rosters')
      .update({
        roster_name: username,
        budget_spent: budgetSpent,
      })
      .eq('id', rosterId);

    if (rosterError) throw rosterError;

    // Remove existing roster players
    const { error: deleteError } = await supabase
      .from('roster_players')
      .delete()
      .eq('roster_id', rosterId);

    if (deleteError) throw deleteError;

    // Get tournament_player_ids for selected players
    const { data: tournamentPlayersData, error: tpError } = await supabase
      .from('tournament_players')
      .select('id, pga_player_id')
      .eq('tournament_id', tournamentId)
      .in('pga_player_id', selectedPlayerIds);

    if (tpError) throw tpError;

    // Add new players to roster
    const rosterPlayers = tournamentPlayersData!.map((tp) => ({
      roster_id: rosterId,
      tournament_player_id: tp.id,
    }));

    const { error: rpError } = await supabase
      .from('roster_players')
      .insert(rosterPlayers);

    if (rpError) throw rpError;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const budgetSpent = getBudgetSpent();

  const getSelectedPlayers = () => {
    return selectedPlayerIds.map((playerId) => {
      const tp = tournamentPlayers.find((t) => t.pga_player_id === playerId);
      return tp;
    }).filter(Boolean);
  };

  return (
    <div className="space-y-6">
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden">
            {/* Header with gradient background */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-4 relative">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="absolute top-3 right-3 text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <div className="flex items-center gap-2">
                <div className="bg-white rounded-full p-1.5">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Roster {existingRoster ? 'Updated' : 'Submitted'}!
                  </h2>
                  <p className="text-green-50 text-xs">
                    Successfully {existingRoster ? 'updated' : 'created'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(85vh-140px)]">
              {/* Roster Summary Cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg p-3 border border-green-200">
                  <div className="text-xs text-gray-600 mb-0.5">Total Cost</div>
                  <div className="text-xl font-bold text-green-700">
                    ${budgetSpent.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">
                    of ${BUDGET_LIMIT.toFixed(2)}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                  <div className="text-xs text-gray-600 mb-0.5">Players</div>
                  <div className="text-xl font-bold text-blue-700">
                    {selectedPlayerIds.length}
                  </div>
                  <div className="text-xs text-gray-500">
                    of {MAX_PLAYERS} max
                  </div>
                </div>
              </div>

              {/* Player List */}
              <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-3 py-2">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Your Players
                  </h3>
                </div>
                <div className="divide-y divide-gray-100 bg-white">
                  {getSelectedPlayers().map((tp, index) => {
                    const player = tp?.pga_players || tp?.pga_player;
                    return (
                      <div 
                        key={tp?.id || index} 
                        className="px-3 py-2.5 flex items-center justify-between hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-150"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-xs">
                            {index + 1}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{player?.name || 'Unknown Player'}</div>
                            {player?.fedex_cup_ranking && (
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                Rank #{player.fedex_cup_ranking}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-base text-green-600">
                            ${(tp?.cost || 0.20).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => {
                  router.push(`/tournaments/${tournamentId}/roster/${submittedRosterId}`);
                }}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-semibold py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
              >
                View Roster Details
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (onSave) {
                    onSave();
                    setShowSuccessModal(false);
                  } else {
                    router.push(`/tournaments/${tournamentId}`);
                  }
                }}
                className="flex-1 border-2 border-gray-300 hover:border-gray-400 text-gray-700 text-sm font-semibold py-2 rounded-lg hover:bg-gray-50 transition-all duration-200"
              >
                {onSave ? 'Done' : 'Back to Tournament'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {existingRoster ? 'Edit Roster' : 'Create New Roster'}
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Select up to {MAX_PLAYERS} players with a ${BUDGET_LIMIT.toFixed(2)} salary cap
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          <PlayerSelector
            tournamentPlayers={tournamentPlayers}
            selectedPlayerIds={selectedPlayerIds}
            onTogglePlayer={handleTogglePlayer}
            maxPlayers={MAX_PLAYERS}
            budgetLimit={BUDGET_LIMIT}
            budgetSpent={budgetSpent}
            isLoading={isLoading}
            tournamentId={tournamentId}
            venueId={undefined} // TODO: Add venue_id to tournaments table if needed
            tournamentName={tournamentName}
          />

          <div className="flex items-center justify-end gap-4 pt-4 border-t">
            <div className="text-sm text-gray-600 mr-auto">
              <strong>Total Cost:</strong>{' '}
              <span className={`font-bold text-lg ${
                budgetSpent <= BUDGET_LIMIT ? 'text-green-600' : 'text-red-600'
              }`}>
                ${budgetSpent.toFixed(2)} / ${BUDGET_LIMIT.toFixed(2)}
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => router.back()}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              isLoading={isSaving}
              disabled={budgetSpent > BUDGET_LIMIT || selectedPlayerIds.length === 0}
            >
              {existingRoster ? 'Update Roster' : 'Create Roster'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
