'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Tournament {
  id: string;
  name: string;
  status: string;
  rapidapi_tourn_id: string | null;
  start_date: string;
}

interface SyncTeeTimesFormProps {
  tournaments: Tournament[];
}

export function SyncTeeTimesForm({ tournaments }: SyncTeeTimesFormProps) {
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSync = async () => {
    if (!selectedTournament) {
      alert('Please select a tournament');
      return;
    }

    const tournament = tournaments.find(t => t.id === selectedTournament);
    if (!tournament?.rapidapi_tourn_id) {
      alert('This tournament does not have a RapidAPI Event ID');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/scores/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tournament.id,
          liveGolfAPITournamentId: tournament.rapidapi_tourn_id,
        }),
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        alert(`Success! Updated ${data.updatedPlayers?.length || 0} players`);
      } else {
        alert(`Error: ${data.error || 'Sync failed'}`);
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      setResult({ error: error.message });
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Tournament to Sync</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-casino-text mb-2">
            Tournament
          </label>
          <select
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
            className="w-full px-4 py-2 border border-casino-gold/30 rounded-lg bg-casino-card text-casino-text focus:ring-2 focus:ring-casino-gold"
          >
            <option value="">Select a tournament...</option>
            {tournaments.map((tournament) => {
              const hasApiId = !!tournament.rapidapi_tourn_id;
              const statusEmoji = 
                tournament.status === 'active' ? '⭐ ' :
                tournament.status === 'upcoming' ? '📅 ' :
                '✅ ';
              
              return (
                <option 
                  key={tournament.id} 
                  value={tournament.id}
                  disabled={!hasApiId}
                >
                  {statusEmoji}{tournament.name} 
                  {!hasApiId && ' (No API ID)'}
                </option>
              );
            })}
          </select>
        </div>

        {selectedTournament && (
          <div className="p-4 bg-casino-elevated rounded-lg">
            {tournaments.find(t => t.id === selectedTournament) && (
              <div className="text-sm space-y-1">
                <p className="text-casino-gray">
                  <span className="font-medium">RapidAPI Event ID:</span>{' '}
                  <code className="text-casino-gold">
                    {tournaments.find(t => t.id === selectedTournament)?.rapidapi_tourn_id}
                  </code>
                </p>
                <p className="text-casino-gray">
                  <span className="font-medium">Status:</span>{' '}
                  <span className="capitalize">
                    {tournaments.find(t => t.id === selectedTournament)?.status}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}

        <Button
          onClick={handleSync}
          disabled={loading || !selectedTournament}
          className="w-full btn-casino-gold"
        >
          {loading ? 'Syncing...' : 'Sync Tee Times & Scores'}
        </Button>

        {result && (
          <div className={`p-4 rounded-lg ${
            result.success 
              ? 'bg-casino-green/10 border border-casino-green/30' 
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            <pre className="text-xs overflow-auto text-casino-text">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
