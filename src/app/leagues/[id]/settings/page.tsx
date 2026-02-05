'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import Image from 'next/image';
import { getLeagueSettings, updateLeagueSettings, uploadVenmoQRCode } from '@/lib/actions/league';

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

interface Member {
  user_id: string;
  username: string;
  email: string;
  joined_at: string;
  is_commissioner: boolean;
}

export default function LeagueSettingsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [isWelcome, setIsWelcome] = useState(false);
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
  const [members, setMembers] = useState<Member[]>([]);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  
  // Money Board settings state
  const [moneyBoardSettings, setMoneyBoardSettings] = useState({
    google_sheet_url: '',
    google_sheet_embed_url: '',
    buy_in_amount: '',
    venmo_username: '',
    venmo_qr_image_path: '',
    payment_instructions: '',
    payout_description: '',
  });
  const [savingMoneyBoard, setSavingMoneyBoard] = useState(false);
  const [moneyBoardSaved, setMoneyBoardSaved] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Resolve params
  useEffect(() => {
    params.then(p => setLeagueId(p.id));
    searchParams.then(sp => setIsWelcome(sp.welcome === 'true'));
  }, [params, searchParams]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!leagueId) return;
    
    try {
      // Fetch tournaments and members in parallel
      const [tournamentsRes, membersRes] = await Promise.all([
        fetch(`/api/leagues/${leagueId}/tournaments`),
        fetch(`/api/leagues/${leagueId}/members`),
      ]);
      
      const tournamentsData = await tournamentsRes.json();
      const membersData = await membersRes.json();

      if (!tournamentsData.success) {
        setError(tournamentsData.error || 'Failed to load data');
        return;
      }

      setLeague(tournamentsData.league);
      setTournaments(tournamentsData.tournaments);
      setSegments(tournamentsData.segments);
      setIsCommissioner(tournamentsData.isCommissioner);

      if (membersData.success) {
        setMembers(membersData.members);
      }

      // Fetch money board settings
      if (tournamentsData.isCommissioner) {
        const settingsResult = await getLeagueSettings(leagueId);
        if (settingsResult.success && settingsResult.settings) {
          setMoneyBoardSettings({
            google_sheet_url: settingsResult.settings.google_sheet_url || '',
            google_sheet_embed_url: settingsResult.settings.google_sheet_embed_url || '',
            buy_in_amount: settingsResult.settings.buy_in_amount?.toString() || '',
            venmo_username: settingsResult.settings.venmo_username || '',
            venmo_qr_image_path: settingsResult.settings.venmo_qr_image_path || '',
            payment_instructions: settingsResult.settings.payment_instructions || '',
            payout_description: settingsResult.settings.payout_description || '',
          });
        }
      }

      if (!tournamentsData.isCommissioner) {
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

  const formatJoinDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Remove a member from the league
  const removeMember = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to remove "${username}" from the league? This cannot be undone.`)) {
      return;
    }

    setRemovingMember(userId);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      if (!data.success) {
        alert(data.error || 'Failed to remove member');
        return;
      }

      // Update local state
      setMembers(prev => prev.filter(m => m.user_id !== userId));
    } catch (err) {
      console.error('Error removing member:', err);
      alert('Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  };

  // Save money board settings
  const saveMoneyBoardSettings = async () => {
    if (!leagueId) return;
    
    setSavingMoneyBoard(true);
    setMoneyBoardSaved(false);
    
    try {
      const result = await updateLeagueSettings(leagueId, {
        google_sheet_url: moneyBoardSettings.google_sheet_url || null,
        google_sheet_embed_url: moneyBoardSettings.google_sheet_embed_url || null,
        buy_in_amount: moneyBoardSettings.buy_in_amount ? parseInt(moneyBoardSettings.buy_in_amount) : null,
        venmo_username: moneyBoardSettings.venmo_username || null,
        venmo_qr_image_path: moneyBoardSettings.venmo_qr_image_path || null,
        payment_instructions: moneyBoardSettings.payment_instructions || null,
        payout_description: moneyBoardSettings.payout_description || null,
      });
      
      if (!result.success) {
        alert(result.error || 'Failed to save settings');
        return;
      }
      
      setMoneyBoardSaved(true);
      setTimeout(() => setMoneyBoardSaved(false), 3000);
    } catch (err) {
      console.error('Error saving money board settings:', err);
      alert('Failed to save settings');
    } finally {
      setSavingMoneyBoard(false);
    }
  };

  // Upload Venmo QR code image
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !leagueId) return;
    
    setUploadingImage(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const result = await uploadVenmoQRCode(leagueId, formData);
      
      if (!result.success) {
        alert(result.error || 'Failed to upload image');
        return;
      }
      
      setMoneyBoardSettings(prev => ({
        ...prev,
        venmo_qr_image_path: result.publicUrl || ''
      }));
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
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
          {league?.name} - League Settings
        </h1>
        <p className="text-casino-gray mt-1">
          Manage league members and configure tournament settings.
        </p>
      </div>

      {/* Welcome Banner for New Commissioners */}
      {isWelcome && (
        <Card className="bg-casino-green/10 border-casino-green/30 mb-6">
          <CardContent className="py-4">
            <div className="flex items-start gap-4">
              <span className="text-3xl">🎉</span>
              <div>
                <h2 className="text-lg font-bold text-casino-green mb-1">
                  Welcome, Commissioner!
                </h2>
                <p className="text-sm text-casino-gray mb-3">
                  Your league has been created. Here are a few things to set up:
                </p>
                <ul className="text-sm text-casino-gray space-y-1">
                  <li>• <strong className="text-casino-text">Invite members</strong> - Share an invite link from the Leagues page</li>
                  <li>• <strong className="text-casino-text">Configure segments</strong> - Set up 1st Half, 2nd Half, etc.</li>
                  <li>• <strong className="text-casino-text">Set up Money Board</strong> - Add payment info and payout structure below</li>
                </ul>
                <Button
                  onClick={() => setIsWelcome(false)}
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-casino-gray hover:text-casino-text"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* League Members */}
      <Card className="bg-casino-card border-casino-gold/20 mb-6">
        <CardHeader>
          <CardTitle className="text-casino-gold">League Roster ({members.length} members)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
                  <th className="px-2 sm:px-4 py-3">Username</th>
                  <th className="px-2 sm:px-4 py-3 hidden sm:table-cell">Email</th>
                  <th className="px-2 sm:px-4 py-3 hidden md:table-cell">Joined</th>
                  <th className="px-2 sm:px-4 py-3 text-center">Role</th>
                  <th className="px-2 sm:px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr 
                    key={member.user_id}
                    className={`border-b border-casino-gold/10 transition-colors hover:bg-casino-elevated ${
                      member.is_commissioner ? 'bg-casino-gold/5' : ''
                    }`}
                  >
                    <td className="px-2 sm:px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-casino-text">
                          {member.username}
                        </span>
                        <span className="text-xs text-casino-gray sm:hidden">
                          {member.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-casino-gray hidden sm:table-cell">
                      {member.email}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-casino-gray hidden md:table-cell">
                      {formatJoinDate(member.joined_at)}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center">
                      {member.is_commissioner ? (
                        <span className="px-2 py-1 bg-casino-gold/20 text-casino-gold rounded text-xs font-medium">
                          Commissioner
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-casino-elevated text-casino-gray rounded text-xs">
                          Member
                        </span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center">
                      {member.is_commissioner ? (
                        <span className="text-xs text-casino-gray">-</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeMember(member.user_id, member.username)}
                          disabled={removingMember === member.user_id}
                          className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        >
                          {removingMember === member.user_id ? 'Removing...' : 'Remove'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {members.length === 0 && (
            <p className="text-center text-casino-gray py-4">No members found</p>
          )}
        </CardContent>
      </Card>

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

      {/* Money Board Settings */}
      <Card className="bg-casino-card border-casino-gold/20 mt-6">
        <CardHeader>
          <CardTitle className="text-casino-gold">💰 Money Board Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-casino-gray mb-6">
            Configure the payment and payout information displayed on your league&apos;s Money Board page.
          </p>
          
          <div className="space-y-6">
            {/* Google Sheet URLs */}
            <div className="space-y-4">
              <h3 className="text-white font-medium">Google Sheet</h3>
              <div>
                <label className="block text-sm text-casino-gray mb-1">
                  Google Sheet URL (for &quot;Open in Sheets&quot; link)
                </label>
                <input
                  type="url"
                  value={moneyBoardSettings.google_sheet_url}
                  onChange={(e) => setMoneyBoardSettings(prev => ({ ...prev, google_sheet_url: e.target.value }))}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-3 py-2 bg-casino-dark border border-casino-gold/30 rounded text-sm text-casino-text focus:outline-none focus:border-casino-gold"
                />
              </div>
              <div>
                <label className="block text-sm text-casino-gray mb-1">
                  Embed URL (for iframe - usually ends in /pubhtml)
                </label>
                <input
                  type="url"
                  value={moneyBoardSettings.google_sheet_embed_url}
                  onChange={(e) => setMoneyBoardSettings(prev => ({ ...prev, google_sheet_embed_url: e.target.value }))}
                  placeholder="https://docs.google.com/spreadsheets/d/e/.../pubhtml"
                  className="w-full px-3 py-2 bg-casino-dark border border-casino-gold/30 rounded text-sm text-casino-text focus:outline-none focus:border-casino-gold"
                />
                <p className="text-xs text-casino-gray mt-1">
                  Tip: In Google Sheets, go to File → Share → Publish to web → Embed tab to get this URL.
                </p>
              </div>
            </div>

            {/* Payment Info */}
            <div className="space-y-4 pt-4 border-t border-casino-gold/20">
              <h3 className="text-white font-medium">Payment Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-casino-gray mb-1">
                    Season Buy-In Amount ($)
                  </label>
                  <input
                    type="number"
                    value={moneyBoardSettings.buy_in_amount}
                    onChange={(e) => setMoneyBoardSettings(prev => ({ ...prev, buy_in_amount: e.target.value }))}
                    placeholder="100"
                    min="0"
                    className="w-full px-3 py-2 bg-casino-dark border border-casino-gold/30 rounded text-sm text-casino-text focus:outline-none focus:border-casino-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm text-casino-gray mb-1">
                    Venmo Username
                  </label>
                  <input
                    type="text"
                    value={moneyBoardSettings.venmo_username}
                    onChange={(e) => setMoneyBoardSettings(prev => ({ ...prev, venmo_username: e.target.value }))}
                    placeholder="@Your-Name"
                    className="w-full px-3 py-2 bg-casino-dark border border-casino-gold/30 rounded text-sm text-casino-text focus:outline-none focus:border-casino-gold"
                  />
                </div>
              </div>
              
              {/* Venmo QR Code Upload */}
              <div>
                <label className="block text-sm text-casino-gray mb-2">
                  Venmo QR Code Image
                </label>
                <div className="flex items-start gap-4">
                  {moneyBoardSettings.venmo_qr_image_path ? (
                    <div className="relative">
                      <Image
                        src={moneyBoardSettings.venmo_qr_image_path}
                        alt="Venmo QR Code"
                        width={100}
                        height={100}
                        className="rounded border border-casino-gold/20"
                      />
                      <button
                        onClick={() => setMoneyBoardSettings(prev => ({ ...prev, venmo_qr_image_path: '' }))}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-casino-red rounded-full text-white text-xs flex items-center justify-center hover:bg-casino-red/80"
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-[100px] h-[100px] border-2 border-dashed border-casino-gold/30 rounded flex items-center justify-center text-casino-gray text-xs text-center">
                      No image
                    </div>
                  )}
                  <div>
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-casino-elevated hover:bg-casino-gold/20 border border-casino-gold/30 rounded text-sm text-casino-text transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                      {uploadingImage ? 'Uploading...' : 'Upload QR Code'}
                    </label>
                    <p className="text-xs text-casino-gray mt-1">Max 2MB, JPG/PNG</p>
                  </div>
                </div>
              </div>

              {/* Payment Instructions */}
              <div>
                <label className="block text-sm text-casino-gray mb-1">
                  Payment Instructions (optional)
                </label>
                <textarea
                  value={moneyBoardSettings.payment_instructions}
                  onChange={(e) => setMoneyBoardSettings(prev => ({ ...prev, payment_instructions: e.target.value }))}
                  placeholder="Payment due before the start of the first tournament..."
                  rows={2}
                  className="w-full px-3 py-2 bg-casino-dark border border-casino-gold/30 rounded text-sm text-casino-text focus:outline-none focus:border-casino-gold resize-none"
                />
              </div>
            </div>

            {/* Payout Description */}
            <div className="pt-4 border-t border-casino-gold/20">
              <h3 className="text-white font-medium mb-4">Payout Structure</h3>
              <div>
                <label className="block text-sm text-casino-gray mb-1">
                  Payout Description
                </label>
                <textarea
                  value={moneyBoardSettings.payout_description}
                  onChange={(e) => setMoneyBoardSettings(prev => ({ ...prev, payout_description: e.target.value }))}
                  placeholder="1st: 45%, 2nd: 30%, 3rd: 15%, 4th: 10%"
                  rows={3}
                  className="w-full px-3 py-2 bg-casino-dark border border-casino-gold/30 rounded text-sm text-casino-text focus:outline-none focus:border-casino-gold resize-none"
                />
                <p className="text-xs text-casino-gray mt-1">
                  Describe how winnings are distributed (e.g., &quot;1st: 45%, 2nd: 30%, 3rd: 15%, 4th: 10%&quot;)
                </p>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-4 pt-4">
              <Button
                onClick={saveMoneyBoardSettings}
                disabled={savingMoneyBoard}
              >
                {savingMoneyBoard ? 'Saving...' : 'Save Money Board Settings'}
              </Button>
              {moneyBoardSaved && (
                <span className="text-casino-green text-sm">✓ Settings saved!</span>
              )}
            </div>
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
