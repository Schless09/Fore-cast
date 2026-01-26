'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface SyncResult {
  success: boolean;
  message?: string;
  error?: string;
  stats?: {
    totalPlayers?: number;
    worldRankingsReceived?: number;
    fedexRankingsReceived?: number;
    worldMatched?: number;
    fedexMatched?: number;
    playersUpdated?: number;
    playersImported?: number;
    fedexRankingsApplied?: number;
    countriesUpdated?: number;
    errors: number;
    durationMs: number;
  };
}

export default function SyncRankingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingCountries, setIsImportingCountries] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSync = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/cron/sync-rankings?manual=true');
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync rankings',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportAll = async () => {
    if (!confirm('⚠️ This will DELETE all existing players, tournament players, and rosters, then import ~1000 players from world rankings. Continue?')) {
      return;
    }

    setIsImporting(true);
    setResult(null);

    try {
      const response = await fetch('/api/cron/sync-rankings', { method: 'POST' });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import players',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCountryImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingCountries(true);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header row
      const dataLines = lines.slice(1);
      
      // Parse CSV into array of {name, country}
      const players = dataLines.map(line => {
        const [name, country] = line.split(',').map(s => s.trim());
        return { name, country };
      }).filter(p => p.name && p.country);

      // Send to API
      const response = await fetch('/api/admin/import-countries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import');
      }

      setResult({
        success: true,
        message: 'Countries imported',
        stats: {
          countriesUpdated: data.stats.countriesUpdated,
          errors: data.stats.notFound,
          durationMs: data.stats.durationMs,
        },
      });
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import countries',
      });
    } finally {
      setIsImportingCountries(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/admin" className="text-blue-600 hover:underline text-sm">
          ← Back to Admin
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sync Player Rankings</h1>
        <p className="text-gray-600">
          Update world rankings and FedEx Cup standings from RapidAPI
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Sync Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm mb-4">
              Update rankings for existing players.
            </p>
            <p className="text-gray-500 text-xs mb-4">
              <strong>Auto:</strong> Mondays 11am CST
            </p>
            <Button
              onClick={handleSync}
              isLoading={isLoading}
              disabled={isLoading || isImporting || isImportingCountries}
              className="w-full"
            >
              {isLoading ? 'Syncing...' : '🔄 Sync Rankings'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="text-orange-700">Import All Players</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm mb-4">
              Delete all & import ~1000 from rankings.
            </p>
            <p className="text-orange-600 text-xs mb-4">
              ⚠️ Deletes rosters!
            </p>
            <Button
              onClick={handleImportAll}
              isLoading={isImporting}
              disabled={isLoading || isImporting || isImportingCountries}
              variant="outline"
              className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              {isImporting ? 'Importing...' : '📥 Import Players'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-700">Import Countries</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm mb-4">
              Upload CSV with Player_Name, Country_Code
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCountryImport}
              disabled={isLoading || isImporting || isImportingCountries}
              className="hidden"
              id="country-csv"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              isLoading={isImportingCountries}
              disabled={isLoading || isImporting || isImportingCountries}
              variant="outline"
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              {isImportingCountries ? 'Importing...' : '🌍 Upload CSV'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <CardHeader>
            <CardTitle className={result.success ? 'text-green-800' : 'text-red-800'}>
              {result.success ? '✅ Sync Complete' : '❌ Sync Failed'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.error && (
              <p className="text-red-700 mb-4">{result.error}</p>
            )}
            
            {result.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {result.stats.countriesUpdated !== undefined ? (
                  // Country import results
                  <>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-blue-600">
                        {result.stats.countriesUpdated}
                      </div>
                      <div className="text-xs text-gray-500">Countries Updated</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-orange-600">
                        {result.stats.errors}
                      </div>
                      <div className="text-xs text-gray-500">Not Found</div>
                    </div>
                  </>
                ) : result.stats.playersImported !== undefined ? (
                  // Import results
                  <>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-green-600">
                        {result.stats.playersImported}
                      </div>
                      <div className="text-xs text-gray-500">Players Imported</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-purple-600">
                        {result.stats.fedexRankingsApplied}
                      </div>
                      <div className="text-xs text-gray-500">FedEx Applied</div>
                    </div>
                  </>
                ) : (
                  // Sync results
                  <>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-gray-900">
                        {result.stats.playersUpdated}
                      </div>
                      <div className="text-xs text-gray-500">Players Updated</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-blue-600">
                        {result.stats.worldMatched}
                      </div>
                      <div className="text-xs text-gray-500">World Rankings</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-purple-600">
                        {result.stats.fedexMatched}
                      </div>
                      <div className="text-xs text-gray-500">FedEx Rankings</div>
                    </div>
                  </>
                )}
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-gray-600">
                    {(result.stats.durationMs / 1000).toFixed(1)}s
                  </div>
                  <div className="text-xs text-gray-500">Duration</div>
                </div>
              </div>
            )}

            {result.stats && (
              <div className="mt-4 text-sm text-gray-600">
                {result.stats.worldRankingsReceived && (
                  <p>
                    Received {result.stats.worldRankingsReceived} world rankings and{' '}
                    {result.stats.fedexRankingsReceived} FedEx standings from API.
                  </p>
                )}
                {result.stats.errors > 0 && (
                  <p className="text-orange-600 mt-1">
                    ⚠️ {result.stats.errors} errors occurred
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>What Gets Updated</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-500">🌍</span>
              <span><strong>World Ranking:</strong> Official World Golf Ranking position</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500">🏆</span>
              <span><strong>FedEx Cup Ranking:</strong> Current PGA Tour season standings</span>
            </li>
          </ul>
          <p className="text-xs text-gray-500 mt-4">
            Players are matched by name. If a player&apos;s name in the database doesn&apos;t 
            exactly match the RapidAPI data, they won&apos;t be updated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
