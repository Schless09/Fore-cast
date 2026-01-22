'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function DebugPlayersPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDebug = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/admin/debug-player-matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: '6466ea54-5648-4fa6-aa0f-31b96e8ffbef', // The American Express
          liveGolfAPITournamentId: '291e61c6-b1e4-49d6-a84e-99864e73a2be',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to debug players');
      }

      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Failed to debug players');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Back to Admin
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-casino-gold mb-2">
          Debug Player Matching
        </h1>
        <p className="text-casino-gray">
          Find which players aren't matching between database and LiveGolfAPI
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Check Player Names</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handleDebug} isLoading={isLoading}>
            Check The American Express Players
          </Button>

          {error && (
            <div className="mt-4 p-3 text-sm text-red-400 bg-red-950/50 border border-red-800/50 rounded-lg">
              {error}
            </div>
          )}

          {results && (
            <div className="mt-6 space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-casino-elevated p-4 rounded-lg border border-casino-gold/30">
                  <div className="text-2xl font-bold text-casino-gold">
                    {results.summary.totalInAPI}
                  </div>
                  <div className="text-xs text-casino-gray">In LiveGolfAPI</div>
                </div>
                <div className="bg-casino-elevated p-4 rounded-lg border border-casino-gold/30">
                  <div className="text-2xl font-bold text-casino-gold">
                    {results.summary.totalInDatabase}
                  </div>
                  <div className="text-xs text-casino-gray">In Database</div>
                </div>
                <div className="bg-casino-elevated p-4 rounded-lg border border-green-500/30">
                  <div className="text-2xl font-bold text-casino-green">
                    {results.summary.matched}
                  </div>
                  <div className="text-xs text-casino-gray">✓ Matched</div>
                </div>
                <div className="bg-casino-elevated p-4 rounded-lg border border-red-500/30">
                  <div className="text-2xl font-bold text-red-400">
                    {results.summary.unmatchedInAPI}
                  </div>
                  <div className="text-xs text-casino-gray">Missing in DB</div>
                </div>
                <div className="bg-casino-elevated p-4 rounded-lg border border-yellow-500/30">
                  <div className="text-2xl font-bold text-yellow-400">
                    {results.summary.unmatchedInDB}
                  </div>
                  <div className="text-xs text-casino-gray">Not in API</div>
                </div>
              </div>

              {/* Unmatched in API */}
              {results.unmatchedInAPI.length > 0 && (
                <Card className="border-red-500/30">
                  <CardHeader>
                    <CardTitle className="text-red-400">
                      ❌ Players in LiveGolfAPI but NOT in Database ({results.unmatchedInAPI.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-casino-gray mb-3">
                      These players are playing but won't get scores synced because they're not in your database.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {results.unmatchedInAPI.map((name: string) => (
                        <div
                          key={name}
                          className="text-sm text-casino-text bg-casino-card p-2 rounded border border-casino-gold/20"
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Unmatched in DB */}
              {results.unmatchedInDB.length > 0 && (
                <Card className="border-yellow-500/30">
                  <CardHeader>
                    <CardTitle className="text-yellow-400">
                      ⚠️ Players in Database but NOT in LiveGolfAPI ({results.unmatchedInDB.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-casino-gray mb-3">
                      These players are in your database but not playing in this tournament (or names don't match).
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {results.unmatchedInDB.map((name: string) => (
                        <div
                          key={name}
                          className="text-sm text-casino-text bg-casino-card p-2 rounded border border-casino-gold/20"
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Matched */}
              <Card className="border-green-500/30">
                <CardHeader>
                  <CardTitle className="text-casino-green">
                    ✓ Successfully Matched Players ({results.matched.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
                    {results.matched.map((name: string) => (
                      <div
                        key={name}
                        className="text-xs text-casino-gray bg-casino-elevated p-2 rounded"
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
