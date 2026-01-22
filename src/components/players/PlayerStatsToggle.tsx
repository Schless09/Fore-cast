'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface HistoricalResult {
  id: string;
  tournament_name: string;
  course_name: string | null;
  tournament_date: string;
  finish_position: number | null;
  is_made_cut: boolean;
  total_score: number | null;
  strokes_gained_total: number | null;
  prize_money: number | null;
}

interface PlayerStatsToggleProps {
  recentResults: HistoricalResult[];
  venueResults: HistoricalResult[];
  venueName: string | null;
}

export default function PlayerStatsToggle({
  recentResults,
  venueResults,
  venueName,
}: PlayerStatsToggleProps) {
  const [view, setView] = useState<'recent' | 'venue'>('recent');

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  const formatMoney = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatScore = (score: number | null) => {
    if (score === null) return '-';
    if (score === 0) return 'E';
    return score > 0 ? `+${score}` : score.toString();
  };

  const formatPosition = (position: number | null, madeCut: boolean) => {
    if (!madeCut) return 'CUT';
    if (!position) return '-';
    return `T${position}`;
  };

  const resultsToShow = view === 'recent' ? recentResults : venueResults;
  const hasVenueData = venueResults.length > 0;

  // Calculate stats
  const avgFinish = resultsToShow.length > 0
    ? resultsToShow.filter(r => r.finish_position).reduce((acc, r) => acc + (r.finish_position || 0), 0) / resultsToShow.filter(r => r.finish_position).length
    : null;

  const cutsMade = resultsToShow.filter(r => r.is_made_cut).length;
  const cutPercentage = resultsToShow.length > 0
    ? ((cutsMade / resultsToShow.length) * 100).toFixed(0)
    : null;

  const top10s = resultsToShow.filter(r => r.finish_position && r.finish_position <= 10).length;
  const top25s = resultsToShow.filter(r => r.finish_position && r.finish_position <= 25).length;

  return (
    <div className="space-y-4">
      {/* Toggle Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => setView('recent')}
          variant={view === 'recent' ? 'primary' : 'outline'}
          className={view === 'recent' ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          Last 20 Events
        </Button>
        <Button
          onClick={() => setView('venue')}
          variant={view === 'venue' ? 'primary' : 'outline'}
          className={view === 'venue' ? 'bg-green-600 hover:bg-green-700' : ''}
          disabled={!hasVenueData}
        >
          {venueName ? `History at ${venueName}` : 'Course History'}
          {hasVenueData && ` (${venueResults.length})`}
        </Button>
      </div>

      {/* Stats Summary */}
      {resultsToShow.length > 0 && (
        <Card className="bg-linear-to-r from-green-50 to-blue-50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Events</div>
                <div className="text-2xl font-bold text-gray-900">{resultsToShow.length}</div>
              </div>
              {avgFinish && (
                <div>
                  <div className="text-sm text-gray-600">Avg Finish</div>
                  <div className="text-2xl font-bold text-gray-900">{avgFinish.toFixed(1)}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-600">Cuts Made</div>
                <div className="text-2xl font-bold text-gray-900">
                  {cutsMade}/{resultsToShow.length}
                  {cutPercentage && <span className="text-sm ml-1">({cutPercentage}%)</span>}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Top 10s / Top 25s</div>
                <div className="text-2xl font-bold text-gray-900">
                  {top10s} / {top25s}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {view === 'recent' ? 'Recent Tournament Results' : `Results at ${venueName || 'This Venue'}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resultsToShow.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {view === 'venue' 
                ? 'No historical data available for this venue' 
                : 'No recent results available'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 uppercase text-xs">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Tournament</th>
                    <th className="px-4 py-2">Finish</th>
                    <th className="px-4 py-2">Score</th>
                    <th className="px-4 py-2">SG Total</th>
                    <th className="px-4 py-2 text-right">Winnings</th>
                  </tr>
                </thead>
                <tbody>
                  {resultsToShow.map((result) => (
                    <tr key={result.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(result.tournament_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {result.tournament_name}
                        {result.course_name && (
                          <div className="text-xs text-gray-500">{result.course_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${
                          !result.is_made_cut ? 'text-red-600' :
                          result.finish_position && result.finish_position <= 10 ? 'text-green-600' :
                          'text-gray-900'
                        }`}>
                          {formatPosition(result.finish_position, result.is_made_cut)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {formatScore(result.total_score)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${
                          result.strokes_gained_total && result.strokes_gained_total > 0
                            ? 'text-green-600'
                            : result.strokes_gained_total && result.strokes_gained_total < 0
                            ? 'text-red-600'
                            : 'text-gray-500'
                        }`}>
                          {result.strokes_gained_total?.toFixed(2) || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatMoney(result.prize_money)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
