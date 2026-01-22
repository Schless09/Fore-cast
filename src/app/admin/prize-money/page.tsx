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

export default function AdminPrizeMoneyPage() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState('');
  const [totalPurse, setTotalPurse] = useState('');
  const [prizeData, setPrizeData] = useState('');
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

  const handleImportPrizeMoney = async () => {
    if (!tournamentId.trim() || !totalPurse.trim()) {
      setError('Please select a tournament and enter Total Purse');
      return;
    }

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      let distributions;

      // Try to parse JSON if provided
      if (prizeData.trim()) {
        try {
          const parsed = JSON.parse(prizeData);
          distributions = parsed;
        } catch (parseError) {
          setError('Invalid JSON format');
          setIsUpdating(false);
          return;
        }
      } else {
        setError('Please provide prize money distribution data in JSON format');
        setIsUpdating(false);
        return;
      }

      const response = await fetch('/api/admin/prize-money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          totalPurse: parseFloat(totalPurse),
          distributions,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import prize money');
      }

      setMessage(result.message || 'Prize money distribution imported successfully');
      setPrizeData(''); // Clear form on success
    } catch (err: any) {
      setError(err.message || 'Failed to import prize money');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCalculateWinnings = async () => {
    if (!tournamentId.trim()) {
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
        body: JSON.stringify({ tournamentId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to calculate winnings');
      }

      setMessage(result.message || 'Winnings calculated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to calculate winnings');
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
          Prize Money Distribution
        </h1>
        <p className="text-gray-600">
          Import prize money distribution for tournaments. Winnings are calculated based on final position and ties.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Import Prize Money Distribution</CardTitle>
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
              htmlFor="totalPurse"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Total Purse ($)
            </label>
            <input
              id="totalPurse"
              type="number"
              value={totalPurse}
              onChange={(e) => setTotalPurse(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white"
              placeholder="9200000"
            />
          </div>

          <div>
            <label
              htmlFor="prizeData"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Prize Money Distribution (JSON)
            </label>
            <textarea
              id="prizeData"
              value={prizeData}
              onChange={(e) => setPrizeData(e.target.value)}
              rows={15}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm text-gray-900 bg-white"
              placeholder={`[\n  {\n    "position": 1,\n    "percentage": 18.00,\n    "amount": 1656000\n  },\n  {\n    "position": 2,\n    "percentage": 10.90,\n    "amount": 1002800\n  }\n]`}
            />
            <p className="mt-1 text-xs text-gray-500">
              Format: Array of objects with position, percentage (optional), and amount (in dollars).
              <br />
              Ties are handled automatically when calculating winnings.
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

          <div className="flex items-center gap-4">
            <Button
              onClick={handleImportPrizeMoney}
              isLoading={isUpdating}
              disabled={!tournamentId.trim() || !totalPurse.trim()}
            >
              Import Prize Money
            </Button>
            <Button
              variant="outline"
              onClick={handleCalculateWinnings}
              isLoading={isUpdating}
              disabled={!tournamentId.trim()}
            >
              Calculate Winnings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            The scoring system is based on actual tournament prize money:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-600 mb-4">
            <li><strong>Import Prize Money:</strong> Upload the prize money distribution table for the tournament</li>
            <li><strong>Update Scores:</strong> Sync player positions from LiveGolfAPI</li>
            <li><strong>Calculate Winnings:</strong> System automatically calculates each player's prize money based on final position</li>
            <li><strong>Handle Ties:</strong> If players tie, they split the combined prize money of all tied positions</li>
            <li><strong>Roster Total:</strong> Each roster's total winnings = sum of all players' prize money</li>
          </ol>
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Example:</strong> If 2 players tie for 2nd place, they split the 2nd and 3rd place prize money.
              If you're the only person who picked the winner, you get the full 1st place prize money even if your other 9 players missed the cut.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
