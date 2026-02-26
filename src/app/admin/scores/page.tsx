'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Tournament {
  id: string;
  name: string;
  status: string;
  rapidapi_tourn_id: string | null;
}

interface TournamentPlayerRow {
  id: string;
  pga_player_id: string;
  withdrawn: boolean;
  pga_players: { name: string } | { name: string }[] | null;
}

export default function AdminScoresPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [tournamentPlayers, setTournamentPlayers] = useState<TournamentPlayerRow[]>([]);
  const [withdrawalSelection, setWithdrawalSelection] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch tournaments on mount
  useEffect(() => {
    async function fetchTournaments() {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('tournaments')
          .select('id, name, status, rapidapi_tourn_id')
          .order('start_date', { ascending: false });

        if (fetchError) throw fetchError;
        setTournaments(data || []);
        
        // Auto-select first active or completed tournament
        const defaultTournament = data?.find(t => t.status === 'active' || t.status === 'completed');
        if (defaultTournament) {
          setSelectedTournament(defaultTournament);
        }
      } catch (err: unknown) {
        console.error('Error fetching tournaments:', err);
        setError('Failed to load tournaments');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTournaments();
  }, []);

  const handleTournamentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tournament = tournaments.find(t => t.id === e.target.value);
    setSelectedTournament(tournament || null);
    setTournamentPlayers([]);
    setWithdrawalSelection(new Set());
    setMessage(null);
    setError(null);
  };

  const loadTournamentPlayers = useCallback(async () => {
    if (!selectedTournament) return;
    setIsLoadingPlayers(true);
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('tournament_players')
        .select('id, pga_player_id, withdrawn, pga_players(name)')
        .eq('tournament_id', selectedTournament.id)
        .order('cost', { ascending: false });
      if (fetchError) throw fetchError;
      setTournamentPlayers(data || []);
    } catch (err) {
      console.error('Error loading tournament players:', err);
      setTournamentPlayers([]);
    } finally {
      setIsLoadingPlayers(false);
    }
  }, [selectedTournament]);

  useEffect(() => {
    // Load players for upcoming (pre-tournament WD) and active/completed (day-of or late WD)
    if (selectedTournament && ['upcoming', 'active', 'completed'].includes(selectedTournament.status)) {
      loadTournamentPlayers();
    } else {
      setTournamentPlayers([]);
    }
  }, [selectedTournament, loadTournamentPlayers]);

  const handleMarkWithdrawn = async () => {
    if (!selectedTournament || withdrawalSelection.size === 0) return;
    setIsUpdating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournament.id,
          pgaPlayerIds: Array.from(withdrawalSelection),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to mark withdrawals');
      setMessage(`✅ ${result.message}`);
      setWithdrawalSelection(new Set());
      loadTournamentPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark withdrawals');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnmarkWithdrawn = async (pgaPlayerId: string) => {
    if (!selectedTournament) return;
    setIsUpdating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournament.id,
          pgaPlayerIds: [pgaPlayerId],
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to unmark');
      setMessage(`✅ ${result.message}`);
      loadTournamentPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unmark');
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleWithdrawalSelect = (pgaPlayerId: string) => {
    setWithdrawalSelection((prev) => {
      const next = new Set(prev);
      if (next.has(pgaPlayerId)) next.delete(pgaPlayerId);
      else next.add(pgaPlayerId);
      return next;
    });
  };



  const handleSyncFromRapidAPI = async () => {
    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/scores/auto-sync?force=true');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync scores');
      }

      setMessage(`✅ ${result.message || 'Scores synced successfully!'}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to sync scores';
      setError(errorMsg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCalculateWinnings = async () => {
    if (!selectedTournament) {
      setError('Please select a tournament');
      return;
    }

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/scores/calculate-winnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: selectedTournament.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to calculate winnings');
      }

      setMessage(
        `✅ ${result.message || 'Winnings calculated successfully!'} Total Purse: $${result.totalPurse?.toLocaleString() || '0'}`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to calculate winnings');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendWouldaCoulda = async () => {
    if (!selectedTournament) {
      setError('Please select a tournament');
      return;
    }

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/rosters/send-woulda-coulda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: selectedTournament.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send woulda-coulda emails');
      }

      setMessage(
        `✅ Sent ${result.recipientsCount ?? 0} woulda-coulda email(s) for ${selectedTournament.name}.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send woulda-coulda emails');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Back to Admin
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Sync Scores & Calculate Winnings
        </h1>
        <p className="text-gray-600">
          Automatically sync tournament scores from RapidAPI and calculate player winnings.
        </p>
      </div>

      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-blue-900 mb-3">📋 Workflow to Calculate Winnings:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>
              <strong>Import Prize Money</strong> for the tournament on the{' '}
              <Link href="/admin/prize-money" className="underline hover:text-blue-600">
                Prize Money page
              </Link>
            </li>
            <li>
              <strong>Select Tournament</strong> below and click &quot;🔄 Sync Scores&quot;
            </li>
            <li>
              <strong>Click &quot;💰 Calculate Winnings&quot;</strong> to update Team Standings
            </li>
          </ol>
          <p className="text-xs text-blue-700 mt-3">
            ⚠️ Winnings won&apos;t show in Team Standings until all three steps are complete.
          </p>
        </CardContent>
      </Card>

      {/* Tournament Selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Tournament</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tournament
            </label>
            <select
              value={selectedTournament?.id || ''}
              onChange={handleTournamentChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900"
            >
              {tournaments.length === 0 && (
                <option value="">No tournaments found</option>
              )}
              {tournaments.map((t) => {
                const statusEmoji = 
                  t.status === 'active' ? '🔴 ' :
                  t.status === 'upcoming' ? '📅 ' :
                  '✅ ';
                const hasLiveGolfId = t.rapidapi_tourn_id ? '✓' : '⚠️ Missing ID';
                
                return (
                  <option key={t.id} value={t.id}>
                    {statusEmoji}{t.name} - {hasLiveGolfId}
                  </option>
                );
              })}
            </select>
            {selectedTournament && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-600">
                  <strong>Status:</strong> {selectedTournament.status}
                </p>
                <p className="text-xs text-gray-600">
                  <strong>RapidAPI Event ID:</strong>{' '}
                  {selectedTournament.rapidapi_tourn_id ? (
                    <span className="font-mono bg-gray-100 px-1 rounded">{selectedTournament.rapidapi_tourn_id}</span>
                  ) : (
                    <span className="text-orange-600">⚠️ Not set - update tournament in database</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 text-sm text-green-600 bg-green-50 rounded-lg">
              {message}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button
              onClick={handleSyncFromRapidAPI}
              isLoading={isUpdating}
              className="flex-1"
            >
              🔄 Force Sync Scores
            </Button>
            <Button
              variant="outline"
              onClick={handleCalculateWinnings}
              isLoading={isUpdating}
              disabled={!selectedTournament}
              className="flex-1 bg-green-50 border-green-600 text-green-700 hover:bg-green-100"
            >
              💰 Calculate Winnings
            </Button>
            <Button
              variant="outline"
              onClick={handleSendWouldaCoulda}
              isLoading={isUpdating}
              disabled={!selectedTournament}
              className="flex-1 bg-amber-50 border-amber-600 text-amber-700 hover:bg-amber-100"
              title="Send 'woulda coulda' emails to users who edited their roster and would have finished in the money (top 4) with a previous lineup"
            >
              🤔 Send Woulda-Coulda Emails
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mark Withdrawals - upcoming, active, and completed (for day-of or late scratches) */}
      {selectedTournament && ['upcoming', 'active', 'completed'].includes(selectedTournament.status) && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle>Mark Withdrawals (WD)</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Select players who have withdrawn. They&apos;ll show &quot;WD&quot; with strikethrough in the roster builder, and affected roster owners will receive an email.
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <strong>Replacements:</strong> The CBS cron (Tue–Thu) automatically adds alternates who got into the field. They appear in roster selection with default cost ($2.50). To set proper odds/price, add them via <Link href="/admin/odds" className="text-blue-600 underline">Admin → Odds</Link> (CSV upload or single-player update).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingPlayers ? (
              <div className="flex items-center gap-2 text-gray-600">
                <LoadingSpinner size="sm" />
                Loading players...
              </div>
            ) : (
              <>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white p-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {[...tournamentPlayers]
                      .sort((a, b) => (a.withdrawn === b.withdrawn ? 0 : a.withdrawn ? -1 : 1))
                      .map((tp) => {
                        const name =
                          Array.isArray(tp.pga_players)
                            ? tp.pga_players[0]?.name ?? 'Unknown'
                            : tp.pga_players?.name ?? 'Unknown';
                        if (tp.withdrawn) {
                          return (
                            <div
                              key={tp.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-50"
                            >
                              <span className="text-red-600 text-xs font-medium">WD</span>
                              <span className="text-sm truncate text-gray-900 line-through flex-1">{name}</span>
                              <button
                                type="button"
                                onClick={() => handleUnmarkWithdrawn(tp.pga_player_id)}
                                disabled={isUpdating}
                                className="text-xs text-blue-600 hover:text-blue-800 underline shrink-0"
                              >
                                Unmark
                              </button>
                            </div>
                          );
                        }
                        return (
                          <label
                            key={tp.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50 ${
                              withdrawalSelection.has(tp.pga_player_id) ? 'bg-amber-100' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={withdrawalSelection.has(tp.pga_player_id)}
                              onChange={() => toggleWithdrawalSelect(tp.pga_player_id)}
                              className="rounded"
                            />
                            <span className="text-sm truncate text-gray-900">{name}</span>
                          </label>
                        );
                      })}
                  </div>
                  {tournamentPlayers.length === 0 && (
                    <p className="text-sm text-gray-500 py-4 text-center">No players</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleMarkWithdrawn}
                    isLoading={isUpdating}
                    disabled={withdrawalSelection.size === 0}
                    className="bg-amber-100 border-amber-600 text-amber-800 hover:bg-amber-200"
                  >
                    Mark Selected as WD
                  </Button>
                  {tournamentPlayers.filter((tp) => tp.withdrawn).length > 0 && (
                    <span className="text-sm text-gray-600">
                      {tournamentPlayers.filter((tp) => tp.withdrawn).length} already marked WD
                    </span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-gray-50">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-gray-900 mb-3">ℹ️ How It Works:</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
            <li>
              <strong>Sync Scores:</strong> Fetches leaderboard from RapidAPI and updates player positions automatically
            </li>
            <li>
              <strong>Calculate Winnings:</strong> Calculates prize money for each player based on their position and updates roster totals
            </li>
            <li>
              <strong>Mark Withdrawals:</strong> For upcoming, active, or completed tournaments. Select players who withdrew (e.g. last-minute scratch). They show WD with strikethrough in the roster builder and affected roster owners receive an email.
            </li>
            <li>
              <strong>Send Woulda-Coulda Emails:</strong> Run <em>after</em> winnings are calculated. Sends an email only to users who (1) edited their roster during the tournament, (2) their <strong>current</strong> lineup’s total purse is <strong>lower</strong> than a previous version, and (3) that previous lineup would have placed them <strong>strictly higher</strong> (e.g. 6th → would’ve been 2nd, or 4th → would’ve been 1st).
            </li>
            <li>
              <strong>Team Standings:</strong> Visit{' '}
              <Link href="/standings/weekly" className="text-green-600 underline hover:text-green-700">
                Weekly Standings
              </Link>{' '}
              to see updated winnings
            </li>
          </ul>
          <p className="text-xs text-gray-600 mt-4">
            <strong>Note:</strong> Scores auto-sync every 15 minutes during tournament days (Thu-Sun) via the cron job.
            Tee times are synced from CBS (Tue–Thu pre-tournament via check-withdrawals cron).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
