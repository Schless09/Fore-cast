'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AdminPlayersPage() {
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playersData, setPlayersData] = useState('');

  const handleMetadataImport = async () => {
    setIsImporting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/players/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import metadata');
      }

      setMessage(
        `Successfully updated ${result.updated} players with metadata`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to import metadata');
    } finally {
      setIsImporting(false);
    }
  };

  const handleBulkImport = async () => {
    if (!playersData.trim()) {
      setError('Please provide player names (one per line or JSON array)');
      return;
    }

    setIsImporting(true);
    setError(null);
    setMessage(null);

    try {
      let playerNames: string[] = [];

      // Try to parse as JSON array first
      try {
        const parsed = JSON.parse(playersData);
        if (Array.isArray(parsed)) {
          // Handle array of strings
          if (typeof parsed[0] === 'string') {
            playerNames = parsed;
          } else if (parsed[0]?.playerName) {
            // Handle array of objects with playerName
            playerNames = parsed.map((p: any) => p.playerName);
          } else if (parsed[0]?.name) {
            // Handle array of objects with name
            playerNames = parsed.map((p: any) => p.name);
          }
        }
      } catch {
        // Not JSON, treat as newline-separated
        playerNames = playersData
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
      }

      if (playerNames.length === 0) {
        setError('No valid player names found');
        setIsImporting(false);
        return;
      }

      const response = await fetch('/api/admin/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: playerNames }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import players');
      }

      setMessage(
        `Successfully imported ${result.created} players (${result.skipped} already existed)`
      );
      setPlayersData(''); // Clear form on success
    } catch (err: any) {
      setError(err.message || 'Failed to import players');
    } finally {
      setIsImporting(false);
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
          Manage Players
        </h1>
        <p className="text-gray-600">
          Bulk import PGA Tour players into the database
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Import Players</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="playersData"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Player Names
            </label>
            <textarea
              id="playersData"
              value={playersData}
              onChange={(e) => setPlayersData(e.target.value)}
              rows={15}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm text-gray-900 bg-white"
              placeholder={`Enter player names (one per line) or JSON array:\n\nScottie Scheffler\nLudvig Aberg\nSam Burns\n\nOR\n\n["Scottie Scheffler", "Ludvig Aberg", "Sam Burns"]`}
            />
            <p className="text-sm text-gray-500 mt-1">
              You can paste the JSON from the odds file - it will automatically extract player names
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {message && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">{message}</p>
            </div>
          )}

          <Button
            onClick={handleBulkImport}
            disabled={isImporting}
            className="w-full"
          >
            {isImporting ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Importing Players...
              </>
            ) : (
              'Import Players'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Update Player Metadata (Country, Images, Rankings)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Import player metadata including country codes, world rankings, and FedEx Cup rankings.
            Images will be auto-generated using UI Avatars.
          </p>
          <Button
            onClick={handleMetadataImport}
            disabled={isImporting}
            variant="outline"
          >
            {isImporting ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Importing Metadata...
              </>
            ) : (
              'Import Player Metadata from File'
            )}
          </Button>
          <p className="text-xs text-gray-500">
            This will update players with data from: <code className="bg-gray-100 px-1 py-0.5 rounded">player-metadata.json</code>
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Import from American Express</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            To quickly import all players from The American Express tournament:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-600 text-sm">
            <li>Open the file: <code className="bg-gray-100 px-2 py-1 rounded text-xs">src/app/admin/odds/american-express-2026.json</code></li>
            <li>Copy the entire contents</li>
            <li>Paste it into the text area above</li>
            <li>Click "Import Players" - it will automatically extract the 156 player names</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
