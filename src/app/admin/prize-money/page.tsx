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

interface PrizeDistribution {
  position: number;
  percentage: number | null;
  amount: number;
  tied_2?: number;
  tied_3?: number;
  tied_4?: number;
  tied_5?: number;
  tied_6?: number;
  tied_7?: number;
  tied_8?: number;
  tied_9?: number;
  tied_10?: number;
}

// Parse currency string like "$1,656,000.00" to number
function parseCurrency(value: string): number {
  if (!value) return 0;
  return parseFloat(value.replace(/[$,]/g, '')) || 0;
}

// Parse percentage string like "18%" to number
function parsePercentage(value: string): number | null {
  if (!value) return null;
  return parseFloat(value.replace('%', '')) || null;
}

// Parse CSV content from PGA Tour prize money format
function parseCSV(csvContent: string): { distributions: PrizeDistribution[]; detectedPurse: number } {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  // Parse header to find column indices
  const header = lines[0].split(',').map(h => h.trim());
  const posIdx = header.findIndex(h => h.toLowerCase().includes('pos'));
  const pctIdx = header.findIndex(h => h.toLowerCase().includes('pct'));
  const amtIdx = header.findIndex(h => h.toLowerCase() === 'amount');
  const tied2Idx = header.findIndex(h => h.toLowerCase().includes('2 tied'));
  const tied3Idx = header.findIndex(h => h.toLowerCase().includes('3 tied'));
  const tied4Idx = header.findIndex(h => h.toLowerCase().includes('4 tied'));
  const tied5Idx = header.findIndex(h => h.toLowerCase().includes('5 tied'));
  const tied6Idx = header.findIndex(h => h.toLowerCase().includes('6 tied'));
  const tied7Idx = header.findIndex(h => h.toLowerCase().includes('7 tied'));
  const tied8Idx = header.findIndex(h => h.toLowerCase().includes('8 tied'));
  const tied9Idx = header.findIndex(h => h.toLowerCase().includes('9 tied'));
  const tied10Idx = header.findIndex(h => h.toLowerCase().includes('10 tied'));

  if (posIdx === -1 || amtIdx === -1) {
    throw new Error('CSV must have Pos. and Amount columns');
  }

  const distributions: PrizeDistribution[] = [];
  let totalFromAmounts = 0;
  let purseFromPercentage: number | null = null;

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted CSV values (amounts have commas)
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim()); // Don't forget the last value

    if (row.length < amtIdx + 1) continue;

    const position = parseInt(row[posIdx]) || 0;
    if (position < 1) continue;

    const amount = parseCurrency(row[amtIdx]);
    const percentage = pctIdx >= 0 ? parsePercentage(row[pctIdx]) : null;

    // Sum all amounts for total purse calculation
    totalFromAmounts += amount;

    // Calculate purse from position 1 if percentage is available (more accurate)
    if (position === 1 && percentage && percentage > 0) {
      purseFromPercentage = Math.round(amount / (percentage / 100));
    }

    const dist: PrizeDistribution = {
      position,
      percentage,
      amount,
    };

    // Add tie columns if present
    if (tied2Idx >= 0 && row[tied2Idx]) dist.tied_2 = parseCurrency(row[tied2Idx]);
    if (tied3Idx >= 0 && row[tied3Idx]) dist.tied_3 = parseCurrency(row[tied3Idx]);
    if (tied4Idx >= 0 && row[tied4Idx]) dist.tied_4 = parseCurrency(row[tied4Idx]);
    if (tied5Idx >= 0 && row[tied5Idx]) dist.tied_5 = parseCurrency(row[tied5Idx]);
    if (tied6Idx >= 0 && row[tied6Idx]) dist.tied_6 = parseCurrency(row[tied6Idx]);
    if (tied7Idx >= 0 && row[tied7Idx]) dist.tied_7 = parseCurrency(row[tied7Idx]);
    if (tied8Idx >= 0 && row[tied8Idx]) dist.tied_8 = parseCurrency(row[tied8Idx]);
    if (tied9Idx >= 0 && row[tied9Idx]) dist.tied_9 = parseCurrency(row[tied9Idx]);
    if (tied10Idx >= 0 && row[tied10Idx]) dist.tied_10 = parseCurrency(row[tied10Idx]);

    distributions.push(dist);
  }

  // Use percentage-based calculation if available (more accurate), otherwise sum of amounts
  const detectedPurse = purseFromPercentage || totalFromAmounts;

  return { distributions, detectedPurse };
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
  const [parsedDistributions, setParsedDistributions] = useState<PrizeDistribution[] | null>(null);
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
        const { distributions, detectedPurse } = parseCSV(csvContent);
        
        setParsedDistributions(distributions);
        setPrizeData(JSON.stringify(distributions, null, 2));
        
        // Always auto-fill purse from CSV
        setTotalPurse(detectedPurse.toString());
        
        setMessage(`Parsed ${distributions.length} positions from CSV (Total Purse: $${detectedPurse.toLocaleString()})`);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse CSV');
        setParsedDistributions(null);
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

      // Use parsed distributions if available, otherwise try JSON
      if (parsedDistributions) {
        distributions = parsedDistributions;
      } else if (prizeData.trim()) {
        try {
          const parsed = JSON.parse(prizeData);
          distributions = parsed;
        } catch {
          setError('Invalid JSON format. Try uploading a CSV file instead.');
          setIsUpdating(false);
          return;
        }
      } else {
        setError('Please upload a CSV file or provide prize money distribution data');
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
      setParsedDistributions(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import prize money');
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to calculate winnings');
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
              Upload a CSV with columns: Pos., Pct., Amount, 2 Tied, 3 Tied, etc.
              {parsedDistributions && (
                <span className="text-green-600 ml-2">
                  ✓ {parsedDistributions.length} positions loaded
                </span>
              )}
            </p>
          </div>

          {parsedDistributions && totalPurse && (
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Total Purse:</strong> ${parseFloat(totalPurse).toLocaleString()}
                <span className="text-green-600 ml-2">(calculated from CSV)</span>
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="prizeData"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Prize Money Distribution (JSON) - Or paste manually
            </label>
            <textarea
              id="prizeData"
              value={prizeData}
              onChange={(e) => {
                setPrizeData(e.target.value);
                setParsedDistributions(null); // Clear parsed when manually editing
              }}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-xs text-gray-900 bg-white"
              placeholder={`[\n  {\n    "position": 1,\n    "percentage": 18.00,\n    "amount": 1656000,\n    "tied_2": 818800\n  }\n]`}
            />
            <p className="mt-1 text-xs text-gray-500">
              CSV upload will auto-populate this field. Includes tie amounts (tied_2, tied_3, etc.) for accurate calculations.
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
            <li><strong>Update Scores:</strong> Sync player positions from RapidAPI</li>
            <li><strong>Calculate Winnings:</strong> System automatically calculates each player&apos;s prize money based on final position</li>
            <li><strong>Handle Ties:</strong> If players tie, they split the combined prize money of all tied positions</li>
            <li><strong>Roster Total:</strong> Each roster&apos;s total winnings = sum of all players&apos; prize money</li>
          </ol>
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Example:</strong> If 2 players tie for 2nd place, they split the 2nd and 3rd place prize money.
              If you&apos;re the only person who picked the winner, you get the full 1st place prize money even if your other 9 players missed the cut.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
