'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface Tournament {
  id: string;
  name: string;
  start_date: string;
  status: string;
}

interface ParsedTeeTime {
  name: string;
  country: string;
  tee_time_r1: string | null;
  tee_time_r2: string | null;
  tee_time_r3: string | null;
  tee_time_r4: string | null;
  starting_tee_r1: number | null;
  starting_tee_r2: number | null;
}

export default function TeeTimesAdminPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [rawInput, setRawInput] = useState('');
  const [parsedTeeTimes, setParsedTeeTimes] = useState<ParsedTeeTime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [matchResults, setMatchResults] = useState<{ matched: number; unmatched: string[] } | null>(null);
  
  // Weekend tee times (R3/R4) via JSON
  const [jsonInput, setJsonInput] = useState('');
  const [selectedRound, setSelectedRound] = useState<'3' | '4'>('3');
  const [jsonMessage, setJsonMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingJson, setIsSavingJson] = useState(false);

  useEffect(() => {
    loadTournaments();
  }, []);

  async function loadTournaments() {
    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('tournaments')
      .select('id, name, start_date, status')
      .order('start_date', { ascending: false });

    if (error) {
      setMessage({ type: 'error', text: 'Failed to load tournaments' });
    } else {
      setTournaments(data || []);
    }
    setIsLoading(false);
  }

  /**
   * Parse the pasted tee time data
   * Supports two formats:
   * 1. CSV: Player,R1_Time,R1_Tee_10,R2_Time,R2_Tee_10
   * 2. Tab-separated with asterisk for tee 10
   */
  function parseTeeTimeData(input: string): ParsedTeeTime[] {
    const lines = input.trim().split('\n');
    const results: ParsedTeeTime[] = [];
    
    // Check if this is CSV format with headers
    const firstLine = lines[0]?.toLowerCase() || '';
    const isCSV = firstLine.includes('player') && (firstLine.includes('r1_time') || firstLine.includes(','));
    
    if (isCSV) {
      // CSV format: Player,R1_Time,R1_Tee_10,R2_Time,R2_Tee_10
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 5) continue;
        
        const [name, r1Time, r1Tee10, r2Time, r2Tee10] = parts;
        
        results.push({
          name,
          country: '',
          tee_time_r1: r1Time || null,
          tee_time_r2: r2Time || null,
          tee_time_r3: null,
          tee_time_r4: null,
          starting_tee_r1: r1Tee10?.toUpperCase() === 'TRUE' ? 10 : 1,
          starting_tee_r2: r2Tee10?.toUpperCase() === 'TRUE' ? 10 : 1,
        });
      }
    } else {
      // Tab-separated format with asterisk for tee 10
      let currentCountry = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Skip header line
        if (line.toLowerCase().includes('ctry') && line.toLowerCase().includes('name')) {
          continue;
        }
        
        // Split by tab or multiple spaces
        const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(p => p);
        
        if (parts.length === 1) {
          // This is a country code
          currentCountry = parts[0];
          continue;
        }
        
        if (parts.length >= 2) {
          // Check if first part is a country code (2-3 letters)
          const firstPartIsCountry = /^[A-Z]{2,3}$/.test(parts[0]);
          
          let name: string;
          let r1: string | null = null;
          let r2: string | null = null;
          
          if (firstPartIsCountry) {
            currentCountry = parts[0];
            name = parts[1];
            r1 = parts[2] || null;
            r2 = parts[3] || null;
          } else {
            name = parts[0];
            r1 = parts[1] || null;
            r2 = parts[2] || null;
          }
          
          // Parse tee times and detect starting tee (asterisk = tee 10)
          const parseTime = (time: string | null): { time: string | null; startingTee: number | null } => {
            if (!time) return { time: null, startingTee: null };
            const hasAsterisk = time.includes('*');
            const cleanTime = time.replace('*', '').trim();
            return {
              time: cleanTime || null,
              startingTee: hasAsterisk ? 10 : 1,
            };
          };
          
          const r1Parsed = parseTime(r1);
          const r2Parsed = parseTime(r2);
          
          results.push({
            name,
            country: currentCountry,
            tee_time_r1: r1Parsed.time,
            tee_time_r2: r2Parsed.time,
            tee_time_r3: null,
            tee_time_r4: null,
            starting_tee_r1: r1Parsed.startingTee,
            starting_tee_r2: r2Parsed.startingTee,
          });
        }
      }
    }
    
    return results;
  }

  function handleParse() {
    const parsed = parseTeeTimeData(rawInput);
    setParsedTeeTimes(parsed);
    setMessage({ type: 'success', text: `Parsed ${parsed.length} tee times` });
    setMatchResults(null);
  }

  async function handleSave() {
    if (!selectedTournamentId) {
      setMessage({ type: 'error', text: 'Please select a tournament' });
      return;
    }
    if (parsedTeeTimes.length === 0) {
      setMessage({ type: 'error', text: 'No tee times to save' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const supabase = createClient();

      // Get tournament players with their PGA player names
      const { data: tournamentPlayers, error: tpError } = await supabase
        .from('tournament_players')
        .select('id, pga_player_id, pga_players(name)')
        .eq('tournament_id', selectedTournamentId);

      if (tpError) throw tpError;

      // Fuzzy name normalization for better matching
      const normalizeName = (name: string): string => {
        return name
          .toLowerCase()
          .trim()
          .replace(/\./g, '')
          .replace(/-/g, '') // "Seung-Taek" -> "Seungtaek" for matching
          .replace(/ø/g, 'o')
          .replace(/ö/g, 'o')
          .replace(/ü/g, 'u')
          .replace(/é/g, 'e')
          .replace(/á/g, 'a')
          .replace(/í/g, 'i')
          .replace(/\s+/g, ' ');
      };

      // Common nickname / alternate-name mappings (CSV vs DB)
      const nicknameMap: Record<string, string[]> = {
        'zach': ['zachary', 'zack'],
        'zachary': ['zach', 'zack'],
        'john': ['johnny', 'jon'],
        'johnny': ['john', 'jon'],
        'mike': ['michael'],
        'michael': ['mike'],
        'bob': ['robert', 'bobby'],
        'robert': ['bob', 'bobby'],
        'will': ['william', 'bill'],
        'william': ['will', 'bill'],
        'tom': ['thomas', 'tommy'],
        'thomas': ['tom', 'tommy'],
        'jim': ['james', 'jimmy'],
        'james': ['jim', 'jimmy'],
        'chris': ['christopher'],
        'christopher': ['chris'],
        'matt': ['matthew'],
        'matthew': ['matt'],
        'dan': ['daniel', 'danny'],
        'daniel': ['dan', 'danny'],
        'nick': ['nicholas'],
        'nicholas': ['nick'],
        'nico': ['nicolas'],
        'nicolas': ['nico'],
        'aj': ['a j'],
        'a j': ['aj'],
        'jj': ['j j'],
        'j j': ['jj'],
        'sh': ['s h'],
        's h': ['sh'],
        'cam': ['cameron'],
        'cameron': ['cam'],
      };

      // Create a map of normalized names to tournament_player IDs
      const nameToIdMap = new Map<string, string>();
      const normalizedDbNames = new Map<string, string>(); // normalized -> original
      
      tournamentPlayers?.forEach((tp: any) => {
        const playerName = tp.pga_players?.name;
        if (playerName) {
          const normalized = normalizeName(playerName);
          nameToIdMap.set(normalized, tp.id);
          normalizedDbNames.set(normalized, playerName);
        }
      });

      // Find match with nickname fallback and "Last First" / "First Last" try
      const findMatch = (csvName: string): string | null => {
        const normalized = normalizeName(csvName);
        
        // Direct match
        if (nameToIdMap.has(normalized)) {
          return nameToIdMap.get(normalized)!;
        }
        
        const parts = normalized.split(/\s+/);
        const firstName = parts[0] ?? '';
        const lastName = parts.slice(1).join(' ');
        
        // Try nickname variations (e.g. Nico -> Nicolas)
        const nicknames = nicknameMap[firstName] || [];
        for (const nickname of nicknames) {
          const altName = `${nickname} ${lastName}`.trim();
          if (altName && nameToIdMap.has(altName)) {
            return nameToIdMap.get(altName)!;
          }
        }
        
        // Try "LastName FirstName" in case DB or CSV uses the other order
        if (parts.length >= 2) {
          const swapped = `${lastName} ${firstName}`.trim();
          if (nameToIdMap.has(swapped)) {
            return nameToIdMap.get(swapped)!;
          }
        }
        
        return null;
      };

      let matchedCount = 0;
      const unmatchedNames: string[] = [];

      // Update each player's tee times
      for (const teeTime of parsedTeeTimes) {
        const tournamentPlayerId = findMatch(teeTime.name);

        if (tournamentPlayerId) {
          const { error: updateError } = await supabase
            .from('tournament_players')
            .update({
              tee_time_r1: teeTime.tee_time_r1,
              tee_time_r2: teeTime.tee_time_r2,
              starting_tee_r1: teeTime.starting_tee_r1,
              starting_tee_r2: teeTime.starting_tee_r2,
            })
            .eq('id', tournamentPlayerId);

          if (!updateError) {
            matchedCount++;
          }
        } else {
          unmatchedNames.push(teeTime.name);
        }
      }

      setMatchResults({ matched: matchedCount, unmatched: unmatchedNames });
      setMessage({
        type: 'success',
        text: `Updated ${matchedCount} of ${parsedTeeTimes.length} players`,
      });

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save tee times' });
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Handle JSON input for R3/R4 tee times
   * Expected format:
   * [
   *   { "name": "Player Name", "tee_time": "8:30 AM" },
   *   ...
   * ]
   */
  async function handleSaveJson() {
    if (!selectedTournamentId) {
      setJsonMessage({ type: 'error', text: 'Please select a tournament' });
      return;
    }
    if (!jsonInput.trim()) {
      setJsonMessage({ type: 'error', text: 'Please enter JSON data' });
      return;
    }

    setIsSavingJson(true);
    setJsonMessage(null);

    try {
      const supabase = createClient();
      
      // Parse JSON input - accept both "name" and "player" keys
      let teeTimes: Array<{ name: string; tee_time: string; starting_tee?: number }>;
      try {
        const parsed = JSON.parse(jsonInput);
        if (!Array.isArray(parsed)) {
          throw new Error('JSON must be an array');
        }
        // Normalize to use "name" key (accept "player" as alias)
        teeTimes = parsed.map((entry: { name?: string; player?: string; tee_time: string; starting_tee?: number }) => ({
          name: entry.name || entry.player || '',
          tee_time: entry.tee_time,
          starting_tee: entry.starting_tee,
        }));
      } catch (e: any) {
        setJsonMessage({ type: 'error', text: `Invalid JSON: ${e.message}` });
        setIsSavingJson(false);
        return;
      }

      // Get tournament players with their PGA player names
      const { data: tournamentPlayers, error: tpError } = await supabase
        .from('tournament_players')
        .select('id, pga_player_id, pga_players(name)')
        .eq('tournament_id', selectedTournamentId);

      if (tpError) throw tpError;

      const normalizeName = (name: string): string => {
        return name
          .toLowerCase()
          .trim()
          .replace(/\./g, '')
          .replace(/-/g, '')
          .replace(/ø/g, 'o')
          .replace(/ö/g, 'o')
          .replace(/ü/g, 'u')
          .replace(/é/g, 'e')
          .replace(/á/g, 'a')
          .replace(/í/g, 'i')
          .replace(/\s+/g, ' ');
      };

      // Same nickname/alternate mappings as CSV section (e.g. Nico <-> Nicolas)
      const nicknameMap: Record<string, string[]> = {
        'zach': ['zachary', 'zack'],
        'zachary': ['zach', 'zack'],
        'john': ['johnny', 'jon'],
        'johnny': ['john', 'jon'],
        'mike': ['michael'],
        'michael': ['mike'],
        'bob': ['robert', 'bobby'],
        'robert': ['bob', 'bobby'],
        'will': ['william', 'bill'],
        'william': ['will', 'bill'],
        'tom': ['thomas', 'tommy'],
        'thomas': ['tom', 'tommy'],
        'jim': ['james', 'jimmy'],
        'james': ['jim', 'jimmy'],
        'chris': ['christopher'],
        'christopher': ['chris'],
        'matt': ['matthew'],
        'matthew': ['matt'],
        'dan': ['daniel', 'danny'],
        'daniel': ['dan', 'danny'],
        'nick': ['nicholas'],
        'nicholas': ['nick'],
        'nico': ['nicolas'],
        'nicolas': ['nico'],
        'aj': ['a j'],
        'a j': ['aj'],
        'jj': ['j j'],
        'j j': ['jj'],
        'cam': ['cameron'],
        'cameron': ['cam'],
      };

      const nameToIdMap = new Map<string, string>();
      tournamentPlayers?.forEach((tp: any) => {
        const playerName = tp.pga_players?.name;
        if (playerName) {
          const normalized = normalizeName(playerName);
          nameToIdMap.set(normalized, tp.id);
        }
      });

      const findMatch = (jsonName: string): string | null => {
        const normalized = normalizeName(jsonName);
        if (nameToIdMap.has(normalized)) return nameToIdMap.get(normalized)!;
        const parts = normalized.split(/\s+/);
        const firstName = parts[0] ?? '';
        const lastName = parts.slice(1).join(' ');
        const nicknames = nicknameMap[firstName] || [];
        for (const nickname of nicknames) {
          const altName = `${nickname} ${lastName}`.trim();
          if (altName && nameToIdMap.has(altName)) return nameToIdMap.get(altName)!;
        }
        if (parts.length >= 2) {
          const swapped = `${lastName} ${firstName}`.trim();
          if (nameToIdMap.has(swapped)) return nameToIdMap.get(swapped)!;
        }
        return null;
      };

      let matchedCount = 0;
      const unmatchedNames: string[] = [];
      const teeTimeColumn = selectedRound === '3' ? 'tee_time_r3' : 'tee_time_r4';
      const startingTeeColumn = selectedRound === '3' ? 'starting_tee_r3' : 'starting_tee_r4';

      // Update each player's tee time
      for (const entry of teeTimes) {
        const tournamentPlayerId = findMatch(entry.name);

        if (tournamentPlayerId) {
          const updateData: Record<string, string | number> = { 
            [teeTimeColumn]: entry.tee_time,
            [startingTeeColumn]: entry.starting_tee || 1, // Default to tee 1
          };
          
          const { error: updateError } = await supabase
            .from('tournament_players')
            .update(updateData)
            .eq('id', tournamentPlayerId);

          if (!updateError) {
            matchedCount++;
          }
        } else {
          unmatchedNames.push(entry.name);
        }
      }

      setJsonMessage({
        type: unmatchedNames.length > 0 ? 'success' : 'success',
        text: `Updated R${selectedRound} tee times for ${matchedCount} of ${teeTimes.length} players${unmatchedNames.length > 0 ? `. Unmatched: ${unmatchedNames.join(', ')}` : ''}`,
      });

    } catch (error: any) {
      setJsonMessage({ type: 'error', text: error.message || 'Failed to save tee times' });
    } finally {
      setIsSavingJson(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-casino-gold mb-6">Upload Tee Times</h1>
      <p className="text-casino-gray mb-6">
        Upload Round 1 and Round 2 tee times for a tournament. Do this every Wednesday before the tournament starts.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>1. Select Tournament & Paste Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-casino-gray mb-2">
                Tournament
              </label>
              <select
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="w-full px-3 py-2 bg-casino-dark border border-casino-gold/30 rounded-lg text-casino-text focus:outline-none focus:border-casino-gold"
              >
                <option value="">Select a tournament...</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({new Date(t.start_date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-casino-gray mb-2">
                Upload CSV File
              </label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const text = event.target?.result as string;
                      setRawInput(text);
                      // Auto-parse after upload
                      const parsed = parseTeeTimeData(text);
                      setParsedTeeTimes(parsed);
                      setMessage({ type: 'success', text: `Loaded ${parsed.length} tee times from file` });
                    };
                    reader.readAsText(file);
                  }
                }}
                className="w-full px-3 py-2 bg-casino-dark border border-casino-gold/30 rounded-lg text-casino-text file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-casino-gold file:text-casino-dark file:font-medium file:cursor-pointer"
              />
            </div>

            <div className="text-center text-casino-gray text-sm">— or paste data below —</div>

            <div>
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={`Player,R1_Time,R1_Tee_10,R2_Time,R2_Tee_10
Chad Ramey,12:10 PM,FALSE,1:16 PM,TRUE
...`}
                className="w-full h-40 px-3 py-2 bg-casino-dark border border-casino-gold/30 rounded-lg text-casino-text font-mono text-sm focus:outline-none focus:border-casino-gold"
              />
            </div>

            <Button onClick={handleParse} disabled={!rawInput.trim()}>
              Parse Data
            </Button>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle>2. Preview & Save</CardTitle>
          </CardHeader>
          <CardContent>
            {message && (
              <div
                className={`mb-4 p-3 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-green-900/30 border border-green-500/30 text-green-400'
                    : 'bg-red-900/30 border border-red-500/30 text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}

            {parsedTeeTimes.length > 0 && (
              <>
                <div className="max-h-80 overflow-y-auto mb-4 border border-casino-gold/20 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-casino-elevated">
                      <tr className="border-b border-casino-gold/20">
                        <th className="px-2 py-1.5 text-left text-xs text-casino-gray">Player</th>
                        <th className="px-2 py-1.5 text-center text-xs text-casino-gray">R1</th>
                        <th className="px-2 py-1.5 text-center text-xs text-casino-gray">R2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedTeeTimes.map((tt, idx) => (
                        <tr key={idx} className="border-b border-casino-gold/10">
                          <td className="px-2 py-1 text-casino-text">{tt.name}</td>
                          <td className="px-2 py-1 text-center text-casino-gray">
                            {tt.tee_time_r1}
                            {tt.starting_tee_r1 === 10 && <span className="text-casino-gold">*</span>}
                          </td>
                          <td className="px-2 py-1 text-center text-casino-gray">
                            {tt.tee_time_r2}
                            {tt.starting_tee_r2 === 10 && <span className="text-casino-gold">*</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={isSaving || !selectedTournamentId}
                  className="w-full"
                >
                  {isSaving ? 'Saving...' : `Save ${parsedTeeTimes.length} Tee Times`}
                </Button>
              </>
            )}

            {matchResults && (
              <div className="mt-4 p-3 bg-casino-dark/50 rounded-lg">
                <p className="text-sm text-casino-text">
                  <span className="text-casino-green font-medium">{matchResults.matched}</span> players matched
                </p>
                {matchResults.unmatched.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-red-400 mb-1">
                      {matchResults.unmatched.length} not found:
                    </p>
                    <div className="max-h-32 overflow-y-auto text-xs text-casino-gray">
                      {matchResults.unmatched.map((name, idx) => (
                        <div key={idx}>{name}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekend Tee Times (R3/R4) via JSON */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-casino-gold mb-4">Weekend Tee Times (R3/R4)</h2>
        <p className="text-casino-gray mb-4">
          After the cut on Friday, upload Round 3 and Round 4 tee times via JSON format.
        </p>
        
        <Card>
          <CardHeader>
            <CardTitle>Upload Weekend Tee Times (JSON)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-casino-gray mb-2">
                  Tournament (same as above)
                </label>
                <select
                  value={selectedTournamentId}
                  onChange={(e) => setSelectedTournamentId(e.target.value)}
                  className="w-full px-3 py-2 bg-casino-dark border border-casino-gold/30 rounded-lg text-casino-text focus:outline-none focus:border-casino-gold"
                >
                  <option value="">Select a tournament...</option>
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({new Date(t.start_date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-casino-gray mb-2">
                  Round
                </label>
                <select
                  value={selectedRound}
                  onChange={(e) => setSelectedRound(e.target.value as '3' | '4')}
                  className="w-full px-3 py-2 bg-casino-dark border border-casino-gold/30 rounded-lg text-casino-text focus:outline-none focus:border-casino-gold"
                >
                  <option value="3">Round 3 (Saturday)</option>
                  <option value="4">Round 4 (Sunday)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-casino-gray mb-2">
                JSON Data
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={`[
  { "name": "Scottie Scheffler", "tee_time": "8:30 AM" },
  { "name": "Rory McIlroy", "tee_time": "8:41 AM" },
  { "name": "Jon Rahm", "tee_time": "8:52 AM", "starting_tee": 10 }
]`}
                className="w-full h-64 px-3 py-2 bg-casino-dark border border-casino-gold/30 rounded-lg text-casino-text font-mono text-sm focus:outline-none focus:border-casino-gold"
              />
              <p className="text-xs text-casino-gray mt-2">
                Format: Array of objects with &quot;name&quot;, &quot;tee_time&quot;, and optional &quot;starting_tee&quot; (1 or 10, defaults to 1)
              </p>
            </div>

            {jsonMessage && (
              <div
                className={`p-3 rounded-lg ${
                  jsonMessage.type === 'success'
                    ? 'bg-green-900/30 border border-green-500/30 text-green-400'
                    : 'bg-red-900/30 border border-red-500/30 text-red-400'
                }`}
              >
                {jsonMessage.text}
              </div>
            )}

            <Button
              onClick={handleSaveJson}
              disabled={isSavingJson || !selectedTournamentId || !jsonInput.trim()}
            >
              {isSavingJson ? 'Saving...' : `Save Round ${selectedRound} Tee Times`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
