'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { createClient } from '@/lib/supabase/client';

interface Tournament {
  id: string;
  name: string;
  start_date: string;
  status: string;
}

export default function AdminOddsPage() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState('');
  const [oddsData, setOddsData] = useState('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  useEffect(() => {
    loadTournaments();
  }, []);

  async function loadTournaments() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, start_date, status')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
    } catch (err) {
      console.error('Failed to load tournaments:', err);
      setError('Failed to load tournaments');
    } finally {
      setLoadingTournaments(false);
    }
  }

  const handleUpdateOdds = async () => {
    if (!tournamentId.trim()) {
      setError('Please select a tournament');
      return;
    }

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      let playersData;

      // Try to parse JSON if provided
      if (oddsData.trim()) {
        try {
          const parsed = JSON.parse(oddsData);
          playersData = parsed;
        } catch {
          setError('Invalid JSON format');
          setIsUpdating(false);
          return;
        }
      } else {
        setError('Please provide odds data in JSON format');
        setIsUpdating(false);
        return;
      }

      const response = await fetch('/api/admin/update-odds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          players: playersData,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update odds');
      }

      setMessage(result.message || 'Odds and costs updated successfully');
      setOddsData(''); // Clear form on success
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to update odds');
      } else {
        setError('Failed to update odds');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Back to Admin
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Import Player Odds & Calculate Costs
        </h1>
        <p className="text-gray-600">
          Import sportsbook odds for a tournament. Costs will be automatically calculated based on winner odds.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Update Player Odds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="tournamentId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Tournament
            </label>
            {loadingTournaments ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                <LoadingSpinner size="sm" />
              </div>
            ) : (
              <select
                id="tournamentId"
                value={tournamentId}
                onChange={(e) => setTournamentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white"
              >
                <option value="">Select a tournament...</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.start_date}) - {t.status}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label
              htmlFor="oddsData"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Odds Data (JSON)
            </label>
            <textarea
              id="oddsData"
              value={oddsData}
              onChange={(e) => setOddsData(e.target.value)}
              rows={15}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm text-gray-900 bg-white"
              placeholder={`[\n  {\n    "playerName": "Scottie Scheffler",\n    "winnerOdds": 290,\n    "top5Odds": -145,\n    "top10Odds": -270\n  },\n  {\n    "playerName": "Ben Griffin",\n    "winnerOdds": 2000,\n    "top5Odds": 380,\n    "top10Odds": 190\n  }\n]`}
            />
            <p className="mt-1 text-xs text-gray-500">
              Format: Array of player objects with playerName, winnerOdds (required), top5Odds, and top10Odds.
              <br />
              Winner odds can be positive (+290) or negative (-145). Costs are calculated from winner odds.
            </p>
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

          <Button
            onClick={handleUpdateOdds}
            isLoading={isUpdating}
            disabled={!tournamentId.trim()}
            className="w-full"
          >
            Update Odds & Calculate Costs
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Cost Calculation Formula</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Player costs are automatically calculated from winner odds using the following formula:
          </p>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
              <li><strong>Top Favorites</strong> (odds +290 to +500): ~$12-13</li>
              <li><strong>Good Players</strong> (odds +1000 to +3000): ~$5-7</li>
              <li><strong>Decent Players</strong> (odds +4000 to +10000): ~$2-5</li>
              <li><strong>Long Shots</strong> (odds +15000+): $0.20 (minimum)</li>
            </ul>
          </div>
          <p className="text-sm text-gray-600">
            The formula uses a power-law scaling based on implied probability from sportsbook odds.
            Players are matched by name (case-insensitive), and if a player doesn&apos;t exist in tournament_players,
            a new record will be created.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
