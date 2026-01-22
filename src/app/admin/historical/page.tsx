'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AdminHistoricalDataPage() {
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvData, setCsvData] = useState('');

  const handleImport = async () => {
    if (!csvData.trim()) {
      setError('Please paste CSV data');
      return;
    }

    setIsImporting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/historical/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import data');
      }

      setMessage(
        `Successfully imported ${result.imported} records (${result.skipped} skipped)`
      );
      setCsvData(''); // Clear on success
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import historical data');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Back to Admin
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Import Historical Tournament Data
        </h1>
        <p className="text-gray-600">
          Import player historical performance from CSV files (OpenDataBay format)
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📊 Where to Get Historical Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Free Dataset (2015-2022)</h3>
            <p className="text-sm text-blue-800 mb-2">
              Download from OpenDataBay:
            </p>
            <a
              href="https://www.opendatabay.com/data/ai-ml/1d2e63cd-6a22-47c7-bd5d-0e9cc4997342"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm font-medium"
            >
              PGA Tour Tournament Results (2015-2022) →
            </a>
            <p className="text-xs text-blue-700 mt-2">
              Includes: Tournament results, positions, scores, strokes-gained stats, prize money
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import CSV Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="csvData"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              CSV Data
            </label>
            <textarea
              id="csvData"
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-xs text-gray-900 bg-white"
              placeholder="Paste CSV data here...&#10;&#10;Expected format:&#10;player_name,tournament_name,tournament_date,finish_position,total_score,strokes_gained_total,prize_money,..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Expected columns: player_name, tournament_name, course_name, tournament_date, finish_position, is_made_cut, total_score, strokes_gained_total, strokes_gained_putting, strokes_gained_approach, strokes_gained_around_green, strokes_gained_off_tee, prize_money
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
            onClick={handleImport}
            disabled={isImporting}
            className="w-full"
          >
            {isImporting ? (
              <>
                <span className="mr-2">
                  <LoadingSpinner size="sm" />
                </span>
                Importing...
              </>
            ) : (
              'Import Historical Data'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
