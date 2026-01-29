'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface Tournament {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  segments: number[];
  is_excluded: boolean;
}

interface Segment {
  number: number;
  name: string;
}

interface LeagueData {
  id: string;
  name: string;
}

export default function LeagueSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [league, setLeague] = useState<LeagueData | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [editingSegment, setEditingSegment] = useState<number | null>(null);
  const [editSegmentName, setEditSegmentName] = useState('');

  // Resolve params
  useEffect(() => {
    params.then(p => setLeagueId(p.id));
  }, [params]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!leagueId) return;
    
    try {
      const response = await fetch(`/api/leagues/${leagueId}/tournaments`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to load data');
        return;
      }

      setLeague(data.league);
      setTournaments(data.tournaments);
      setSegments(data.segments);
      setIsCommissioner(data.isCommissioner);

      if (!data.isCommissioner) {
        setError('Only the league commissioner can access this page');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load league settings');
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update tournament segments
  const updateTournament = async (tournamentId: string, newSegments: number[], isExcluded: boolean) => {
    setSaving(tournamentId);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/tournaments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, segments: newSegments, isExcluded }),
      });

      const data = await response.json();
      if (!data.success) {
        alert(data.error || 'Failed to update');
        return;
      }

      // Update local state
      setTournaments(prev => prev.map(t => 
        t.id === tournamentId 
          ? { ...t, segments: newSegments, is_excluded: isExcluded }
          : t
      ));

    } catch (err) {
      console.error('Error updating tournament:', err);
      alert('Failed to update tournament settings');
    } finally {
      setSaving(null);
    }
  };

  // Toggle segment for a tournament
  const toggleSegment = (tournament: Tournament, segmentNumber: number) => {
    const newSegments = tournament.segments.includes(segmentNumber)
      ? tournament.segments.filter(s => s !== segmentNumber)
      : [...tournament.segments, segmentNumber].sort((a, b) => a - b);
    
    updateTournament(tournament.id, newSegments, tournament.is_excluded);
  };

  // Add or update segment name
  const saveSegmentName = async (segmentNumber: number, name: string) => {
    if (!name.trim()) return;
    
    setSaving(`segment-${segmentNumber}`);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentNumber, name: name.trim() }),
      });

      const data = await response.json();
      if (!data.success) {
        alert(data.error || 'Failed to save segment name');
        return;
      }

      // Update local state
      setSegments(prev => {
        const existing = prev.find(s => s.number === segmentNumber);
        if (existing) {
          return prev.map(s => s.number === segmentNumber ? { ...s, name: name.trim() } : s);
        } else {
          return [...prev, { number: segmentNumber, name: name.trim() }].sort((a, b) => a.number - b.number);
        }
      });

      setEditingSegment(null);
      setNewSegmentName('');
    } catch (err) {
      console.error('Error saving segment name:', err);
      alert('Failed to save segment name');
    } finally {
      setSaving(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Get max segment number for adding new segments
  const maxSegmentNumber = Math.max(0, ...segments.map(s => s.number));
  const nextSegmentNumber = maxSegmentNumber + 1;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center text-casino-gray">Loading...</div>
      </div>
    );
  }

  if (error && !isCommissioner) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card className="bg-casino-card border-casino-gold/20">
          <CardContent className="py-8 text-center">
            <p className="text-casino-red mb-4">{error}</p>
            <Link href="/leagues">
              <Button variant="outline">Back to Leagues</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/leagues"
          className="text-casino-gold hover:text-casino-gold/80 mb-4 inline-block"
        >
          ← Back to Leagues
        </Link>
        <h1 className="text-2xl font-bold text-white">
          {league?.name} - Tournament Settings
        </h1>
        <p className="text-casino-gray mt-1">
          Configure which tournaments are included and assign them to segments for season standings.
        </p>
      </div>

      {/* Segment Management */}
      <Card className="bg-casino-card border-casino-gold/20 mb-6">
        <CardHeader>
          <CardTitle className="text-casino-gold">Season Segments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-casino-gray mb-4">
            Create named segments to organize your season (e.g., &quot;1st Half&quot;, &quot;2nd Half&quot;, &quot;Playoffs&quot;). 
            Tournaments can belong to multiple segments.
          </p>
          
          {/* Existing Segments */}
          <div className="space-y-2 mb-4">
            {segments.map(segment => (
              <div key={segment.number} className="flex items-center gap-3 p-3 bg-casino-dark rounded-lg">
                <span className="w-8 h-8 flex items-center justify-center bg-casino-gold/20 text-casino-gold rounded-full font-bold text-sm">
                  {segment.number}
                </span>
                {editingSegment === segment.number ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editSegmentName}
                      onChange={(e) => setEditSegmentName(e.target.value)}
                      className="flex-1 px-3 py-1 bg-casino-card border border-casino-gold/30 rounded text-sm text-casino-text focus:outline-none focus:border-casino-gold"
                      placeholder="Segment name..."
                    />
                    <Button
                      size="sm"
                      onClick={() => saveSegmentName(segment.number, editSegmentName)}
                      disabled={saving === `segment-${segment.number}`}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingSegment(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-casino-text font-medium">{segment.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingSegment(segment.number);
                        setEditSegmentName(segment.name);
                      }}
                      className="text-casino-gray hover:text-casino-gold"
                    >
                      Edit
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add New Segment */}
          <div className="flex items-center gap-3 p-3 bg-casino-elevated rounded-lg border border-dashed border-casino-gold/30">
            <span className="w-8 h-8 flex items-center justify-center bg-casino-gold/10 text-casino-gold/50 rounded-full font-bold text-sm">
              {nextSegmentNumber}
            </span>
            <input
              type="text"
              value={newSegmentName}
              onChange={(e) => setNewSegmentName(e.target.value)}
              className="flex-1 px-3 py-1 bg-casino-card border border-casino-gold/30 rounded text-sm text-casino-text focus:outline-none focus:border-casino-gold"
              placeholder="New segment name (e.g., '1st Half')..."
            />
            <Button
              size="sm"
              onClick={() => saveSegmentName(nextSegmentNumber, newSegmentName)}
              disabled={!newSegmentName.trim() || saving === `segment-${nextSegmentNumber}`}
            >
              Add Segment
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tournament List */}
      <Card className="bg-casino-card border-casino-gold/20">
        <CardHeader>
          <CardTitle className="text-casino-gold">Tournament Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
                  <th className="px-2 sm:px-4 py-3">Tournament</th>
                  <th className="px-2 sm:px-4 py-3 hidden sm:table-cell">Dates</th>
                  <th className="px-2 sm:px-4 py-3 text-center">
                    Segments
                    {segments.length === 0 && (
                      <span className="block text-xs font-normal normal-case text-casino-gray mt-0.5">
                        (create segments above first)
                      </span>
                    )}
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-center">Include</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map((tournament) => (
                  <tr 
                    key={tournament.id}
                    className={`border-b border-casino-gold/10 transition-colors ${
                      tournament.is_excluded 
                        ? 'bg-casino-red/10 opacity-60' 
                        : 'hover:bg-casino-elevated'
                    }`}
                  >
                    <td className="px-2 sm:px-4 py-3">
                      <div className="flex flex-col">
                        <span className={`font-medium ${tournament.is_excluded ? 'text-casino-gray line-through' : 'text-casino-text'}`}>
                          {tournament.name}
                        </span>
                        <span className="text-xs text-casino-gray sm:hidden">
                          {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
                        </span>
                        {/* Mobile: show segment badges */}
                        <div className="flex flex-wrap gap-1 mt-1 sm:hidden">
                          {tournament.segments.length === 0 && !tournament.is_excluded && (
                            <span className="text-xs text-casino-gray">All segments</span>
                          )}
                          {tournament.segments.map(seg => {
                            const segDef = segments.find(s => s.number === seg);
                            return (
                              <span 
                                key={seg}
                                className="px-1.5 py-0.5 bg-casino-gold/20 text-casino-gold rounded text-xs"
                              >
                                {segDef?.name || `Seg ${seg}`}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-casino-gray hidden sm:table-cell">
                      {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
                    </td>
                    <td className="px-2 sm:px-4 py-3">
                      <div className="flex flex-wrap justify-center gap-2">
                        {segments.length === 0 ? (
                          <span className="text-xs text-casino-gray">-</span>
                        ) : (
                          segments.map(segment => (
                            <button
                              key={segment.number}
                              onClick={() => toggleSegment(tournament, segment.number)}
                              disabled={saving === tournament.id || tournament.is_excluded}
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                tournament.segments.includes(segment.number)
                                  ? 'bg-casino-gold text-casino-dark'
                                  : 'bg-casino-elevated text-casino-gray hover:bg-casino-gold/20'
                              } ${tournament.is_excluded ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={segment.name}
                            >
                              {segment.name}
                            </button>
                          ))
                        )}
                      </div>
                      {tournament.segments.length === 0 && !tournament.is_excluded && segments.length > 0 && (
                        <p className="text-xs text-casino-gray text-center mt-1">All segments</p>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center">
                      <button
                        onClick={() => updateTournament(
                          tournament.id, 
                          tournament.segments, 
                          !tournament.is_excluded
                        )}
                        disabled={saving === tournament.id}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          tournament.is_excluded 
                            ? 'bg-casino-gray/30' 
                            : 'bg-casino-green'
                        } ${saving === tournament.id ? 'opacity-50' : ''}`}
                      >
                        <span 
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            tournament.is_excluded ? 'left-1' : 'left-7'
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="bg-casino-card border-casino-gold/20 mt-6">
        <CardContent className="py-4">
          <div className="text-sm text-casino-gray space-y-2">
            <p><strong className="text-casino-text">How it works:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Full Season</strong> standings include all non-excluded tournaments</li>
              <li>Tournaments with <strong>no segments selected</strong> appear in all segment standings</li>
              <li>Tournaments can belong to <strong>multiple segments</strong> (e.g., both &quot;1st Half&quot; and &quot;Playoffs&quot;)</li>
              <li><strong>Excluded</strong> tournaments don&apos;t appear in any standings</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
