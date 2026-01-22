'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Tournament {
  id: string;
  name: string;
  status: string;
  livegolfapi_event_id: string | null;
}

export default function AdminScoresPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
          .select('id, name, status, livegolfapi_event_id')
          .order('start_date', { ascending: false });

        if (fetchError) throw fetchError;
        setTournaments(data || []);
        
        // Auto-select first active or completed tournament
        const defaultTournament = data?.find(t => t.status === 'active' || t.status === 'completed');
        if (defaultTournament) {
          setSelectedTournament(defaultTournament);
        }
      } catch (err: any) {
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
    setMessage(null);
    setError(null);
  };



  const handleSyncFromLiveGolfAPI = async () => {
    if (!selectedTournament) {
      setError('Please select a tournament');
      return;
    }

    if (!selectedTournament.livegolfapi_event_id) {
      setError(`No LiveGolfAPI Event ID found for ${selectedTournament.name}. Please update the tournament in the database.`);
      return;
    }

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/scores/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournament.id,
          liveGolfAPITournamentId: selectedTournament.livegolfapi_event_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync scores from LiveGolfAPI');
      }

      setMessage(`✅ ${result.message || 'Scores synced successfully from LiveGolfAPI!'} Updated ${result.updatedCount || 0} players.`);
    } catch (err: any) {
      setError(err.message || 'Failed to sync scores from LiveGolfAPI');
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
    } catch (err: any) {
      setError(err.message || 'Failed to calculate winnings');
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
          Automatically sync tournament scores from LiveGolfAPI and calculate player winnings.
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
              <strong>Select Tournament</strong> below and click "🔄 Sync Scores"
            </li>
            <li>
              <strong>Click "💰 Calculate Winnings"</strong> to update Team Standings
            </li>
          </ol>
          <p className="text-xs text-blue-700 mt-3">
            ⚠️ Winnings won't show in Team Standings until all three steps are complete.
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
                const hasLiveGolfId = t.livegolfapi_event_id ? '✓' : '⚠️ Missing ID';
                
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
                  <strong>LiveGolfAPI Event ID:</strong>{' '}
                  {selectedTournament.livegolfapi_event_id ? (
                    <span className="font-mono bg-gray-100 px-1 rounded">{selectedTournament.livegolfapi_event_id}</span>
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
              onClick={handleSyncFromLiveGolfAPI}
              isLoading={isUpdating}
              disabled={!selectedTournament || !selectedTournament.livegolfapi_event_id}
              className="flex-1"
            >
              🔄 Sync Scores from LiveGolfAPI
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
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-gray-50">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-gray-900 mb-3">ℹ️ How It Works:</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
            <li>
              <strong>Sync Scores:</strong> Fetches leaderboard from LiveGolfAPI and updates player positions automatically
            </li>
            <li>
              <strong>Calculate Winnings:</strong> Calculates prize money for each player based on their position and updates roster totals
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
            <strong>Note:</strong> For real-time updates during tournaments, set up a cron job to call{' '}
            <code className="bg-gray-200 px-1 rounded text-xs">/api/scores/sync</code> periodically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
