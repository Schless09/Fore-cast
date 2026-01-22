'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TournamentPlayer } from '@/lib/types';
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
}

const MAX_PLAYERS = 10;
const BUDGET_LIMIT = 30.00;

export function RosterBuilder({
  tournamentId,
  existingRoster,
}: RosterBuilderProps) {
  const router = useRouter();
  const [tournamentPlayers, setTournamentPlayers] = useState<
    (TournamentPlayer & { pga_player?: any; pga_players?: any })[]
  >([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(
    existingRoster?.playerIds || []
  );
  const [username, setUsername] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTournamentPlayers();
    loadUserProfile();
  }, [tournamentId]);

  async function loadUserProfile() {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        if (!profileError && profile) {
          setUsername(profile.username);
        } else {
          // Fallback to email username if profile not found
          setUsername(user.email?.split('@')[0] || 'User');
        }
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
      setUsername('User');
    }
  }

  async function loadTournamentPlayers() {
    try {
      const supabase = createClient();

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
    } catch (err: any) {
      setError(err.message || 'Failed to load players');
    } finally {
      setIsLoading(false);
    }
  }

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
    if (!username.trim()) {
      setError('Unable to load username. Please refresh the page.');
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      const budgetSpent = calculateRosterCost(playerCosts);

      if (existingRoster) {
        // Update existing roster
        await updateRoster(existingRoster.id, budgetSpent);
      } else {
        // Create new roster
        await createRoster(budgetSpent);
      }

      router.push(`/tournaments/${tournamentId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to save roster');
    } finally {
      setIsSaving(false);
    }
  }

  async function createRoster(budgetSpent: number) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Create roster with budget tracking (use username as roster name)
    const { data: roster, error: rosterError } = await supabase
      .from('user_rosters')
      .insert({
        user_id: user!.id,
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

  return (
    <div className="space-y-6">
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
