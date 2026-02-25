'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { findTournamentPlayerId, normalizeTeeTimeName } from '@/lib/tee-times-utils';

interface Tournament {
  id: string;
  name: string;
  start_date: string;
  status: string;
}

interface WeekendTeeTimesUploadProps {
  tournaments: Tournament[];
  selectedTournamentId: string;
  onTournamentChange: (id: string) => void;
}

export function WeekendTeeTimesUpload({
  tournaments,
  selectedTournamentId,
  onTournamentChange,
}: WeekendTeeTimesUploadProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [selectedRound, setSelectedRound] = useState<'3' | '4'>('3');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSave() {
    if (!selectedTournamentId) {
      setMessage({ type: 'error', text: 'Please select a tournament' });
      return;
    }
    if (!jsonInput.trim()) {
      setMessage({ type: 'error', text: 'Please enter JSON data' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      let teeTimes: Array<{ name: string; tee_time: string; starting_tee?: number }>;
      try {
        const parsed = JSON.parse(jsonInput);
        if (!Array.isArray(parsed)) throw new Error('JSON must be an array');
        teeTimes = parsed.map(
          (entry: { name?: string; player?: string; tee_time: string; starting_tee?: number }) => ({
            name: entry.name || entry.player || '',
            tee_time: entry.tee_time,
            starting_tee: entry.starting_tee,
          })
        );
      } catch (e: unknown) {
        setMessage({
          type: 'error',
          text: `Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`,
        });
        setIsSaving(false);
        return;
      }

      const supabase = createClient();
      const { data: tournamentPlayers, error: tpError } = await supabase
        .from('tournament_players')
        .select('id, pga_player_id, pga_players(name)')
        .eq('tournament_id', selectedTournamentId);

      if (tpError) throw tpError;

      const nameToIdMap = new Map<string, string>();
      tournamentPlayers?.forEach((tp: { id: string; pga_players?: { name?: string } | { name?: string }[] }) => {
        const pga = tp.pga_players;
        const playerName = Array.isArray(pga) ? pga[0]?.name : pga?.name;
        if (playerName) {
          const normalized = normalizeTeeTimeName(playerName);
          nameToIdMap.set(normalized, tp.id);
          const parts = normalized.split(/\s+/);
          if (parts.length >= 3) {
            nameToIdMap.set(parts[0] + parts[1] + ' ' + parts.slice(2).join(' '), tp.id);
          }
        }
      });

      const teeTimeColumn = selectedRound === '3' ? 'tee_time_r3' : 'tee_time_r4';
      const startingTeeColumn = selectedRound === '3' ? 'starting_tee_r3' : 'starting_tee_r4';
      let matchedCount = 0;
      const unmatchedNames: string[] = [];

      for (const entry of teeTimes) {
        const tournamentPlayerId = findTournamentPlayerId(entry.name, nameToIdMap);
        if (tournamentPlayerId) {
          const { error: updateError } = await supabase
            .from('tournament_players')
            .update({
              [teeTimeColumn]: entry.tee_time,
              [startingTeeColumn]: entry.starting_tee || 1,
            })
            .eq('id', tournamentPlayerId);
          if (!updateError) matchedCount++;
        } else {
          unmatchedNames.push(entry.name);
        }
      }

      setMessage({
        type: 'success',
        text: `Updated R${selectedRound} tee times for ${matchedCount} of ${teeTimes.length} players${
          unmatchedNames.length > 0 ? `. Unmatched: ${unmatchedNames.join(', ')}` : ''
        }`,
      });
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save tee times',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
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
                onChange={(e) => onTournamentChange(e.target.value)}
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
              <label className="block text-sm font-medium text-casino-gray mb-2">Round</label>
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
            <label className="block text-sm font-medium text-casino-gray mb-2">JSON Data</label>
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
              Format: Array of objects with &quot;name&quot;, &quot;tee_time&quot;, and optional
              &quot;starting_tee&quot; (1 or 10, defaults to 1)
            </p>
          </div>
          {message && (
            <div
              className={`p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-900/30 border border-green-500/30 text-green-400'
                  : 'bg-red-900/30 border border-red-500/30 text-red-400'
              }`}
            >
              {message.text}
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || !selectedTournamentId || !jsonInput.trim()}
          >
            {isSaving ? 'Saving...' : `Save Round ${selectedRound} Tee Times`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
