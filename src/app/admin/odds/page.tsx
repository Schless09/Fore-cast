'use client';

import { useState, useEffect, useRef } from 'react';
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

interface PlayerOdds {
  playerName: string;
  winnerOdds: number;
  top5Odds?: number;
  top10Odds?: number;
}

// Parse odds string like "+290", "-145", "290" to number
function parseOdds(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const cleaned = value.toString().replace(/[+\s]/g, '').trim();
  return parseInt(cleaned) || null;
}

// Parse CSV content for odds data
function parseOddsCSV(csvContent: string): PlayerOdds[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  // Parse header to find column indices (flexible naming)
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  // Find player name column
  const nameIdx = header.findIndex(h => 
    h.includes('player') || h.includes('name') || h === 'golfer'
  );
  
  // Find winner odds column
  const winnerIdx = header.findIndex(h => 
    h.includes('winner') || h.includes('win') || h === 'odds' || h.includes('to win')
  );
  
  // Find top 5 odds column
  const top5Idx = header.findIndex(h => 
    h.includes('top 5') || h.includes('top5') || h.includes('t5')
  );
  
  // Find top 10 odds column
  const top10Idx = header.findIndex(h => 
    h.includes('top 10') || h.includes('top10') || h.includes('t10')
  );

  if (nameIdx === -1) {
    throw new Error('CSV must have a Player/Name column');
  }
  if (winnerIdx === -1) {
    throw new Error('CSV must have a Winner/Odds column');
  }

  const players: PlayerOdds[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(v => v.trim());
    
    const playerName = row[nameIdx];
    if (!playerName) continue;

    const winnerOdds = parseOdds(row[winnerIdx]);
    if (winnerOdds === null) continue;

    const player: PlayerOdds = {
      playerName,
      winnerOdds,
    };

    if (top5Idx >= 0 && row[top5Idx]) {
      const top5 = parseOdds(row[top5Idx]);
      if (top5 !== null) player.top5Odds = top5;
    }

    if (top10Idx >= 0 && row[top10Idx]) {
      const top10 = parseOdds(row[top10Idx]);
      if (top10 !== null) player.top10Odds = top10;
    }

    players.push(player);
  }

  return players;
}

export default function AdminOddsPage() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState('');
  const [oddsData, setOddsData] = useState('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [parsedPlayers, setParsedPlayers] = useState<PlayerOdds[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Handle CSV file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string;
        const players = parseOddsCSV(csvContent);
        
        setParsedPlayers(players);
        setOddsData(JSON.stringify(players, null, 2));
        
        setMessage(`Parsed ${players.length} players from CSV`);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse CSV');
        setParsedPlayers(null);
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

      // Use parsed CSV data if available, otherwise try JSON
      if (parsedPlayers) {
        playersData = parsedPlayers;
      } else if (oddsData.trim()) {
        try {
          const parsed = JSON.parse(oddsData);
          playersData = parsed;
        } catch {
          setError('Invalid JSON format. Try uploading a CSV file instead.');
          setIsUpdating(false);
          return;
        }
      } else {
        setError('Please upload a CSV file or provide odds data in JSON format');
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
      setParsedPlayers(null);
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
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Upload CSV File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white file:mr-4 file:py-1 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              CSV columns: Player Name, Winner Odds (required), Top 5 Odds, Top 10 Odds
              {parsedPlayers && (
                <span className="text-green-600 ml-2">
                  ✓ {parsedPlayers.length} players loaded
                </span>
              )}
            </p>
          </div>

          <div>
            <label
              htmlFor="oddsData"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Odds Data (JSON) - Or paste manually
            </label>
            <textarea
              id="oddsData"
              value={oddsData}
              onChange={(e) => {
                setOddsData(e.target.value);
                setParsedPlayers(null); // Clear parsed when manually editing
              }}
              rows={15}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm text-gray-900 bg-white"
              placeholder={`[\n  {\n    "playerName": "Scottie Scheffler",\n    "winnerOdds": 290,\n    "top5Odds": -145,\n    "top10Odds": -270\n  },\n  {\n    "playerName": "Ben Griffin",\n    "winnerOdds": 2000,\n    "top5Odds": 380,\n    "top10Odds": 190\n  }\n]`}
            />
            <p className="mt-1 text-xs text-gray-500">
              CSV upload will auto-populate this field. Format: playerName, winnerOdds (required), top5Odds, top10Odds.
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
