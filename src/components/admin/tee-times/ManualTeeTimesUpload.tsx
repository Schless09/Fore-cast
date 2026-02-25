'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  parseTeeTimeData,
  findTournamentPlayerId,
  normalizeTeeTimeName,
  type ParsedTeeTime,
} from '@/lib/tee-times-utils';

interface Tournament {
  id: string;
  name: string;
  start_date: string;
  status: string;
}

interface ManualTeeTimesUploadProps {
  tournaments: Tournament[];
  selectedTournamentId: string;
  onTournamentChange: (id: string) => void;
}

export function ManualTeeTimesUpload({
  tournaments,
  selectedTournamentId,
  onTournamentChange,
}: ManualTeeTimesUploadProps) {
  const [rawInput, setRawInput] = useState('');
  const [parsedTeeTimes, setParsedTeeTimes] = useState<ParsedTeeTime[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingMissing, setIsAddingMissing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [matchResults, setMatchResults] = useState<{ matched: number; unmatched: string[] } | null>(null);

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

      let matchedCount = 0;
      const unmatchedNames: string[] = [];

      for (const teeTime of parsedTeeTimes) {
        const tournamentPlayerId = findTournamentPlayerId(teeTime.name, nameToIdMap);
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
          if (!updateError) matchedCount++;
        } else {
          unmatchedNames.push(teeTime.name);
        }
      }

      setMatchResults({ matched: matchedCount, unmatched: unmatchedNames });
      setMessage({ type: 'success', text: `Updated ${matchedCount} of ${parsedTeeTimes.length} players` });
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save tee times',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddMissing() {
    if (!selectedTournamentId || !matchResults?.unmatched.length) return;
    setIsAddingMissing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/tee-times/add-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          names: matchResults.unmatched,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to add players' });
        return;
      }
      setMatchResults((prev) =>
        prev && data.notFound?.length !== undefined ? { ...prev, unmatched: data.notFound } : prev
      );
      const parts: string[] = [];
      if (data.added > 0) {
        parts.push(
          `Added ${data.added} to tournament field: ${(data.addedNames ?? []).join(', ')}. Re-parse and Save to apply tee times.`
        );
      }
      if (data.notFound?.length > 0) {
        parts.push(`Not in pga_players: ${data.notFound.join(', ')}.`);
      }
      if (parts.length > 0) {
        setMessage({
          type: data.notFound?.length > 0 ? 'error' : 'success',
          text: parts.join(' '),
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to add players' });
    } finally {
      setIsAddingMissing(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>1. Select Tournament & Paste Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-casino-gray mb-2">Tournament</label>
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
            <label className="block text-sm font-medium text-casino-gray mb-2">Upload CSV File</label>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const text = (event.target?.result as string) ?? '';
                    setRawInput(text);
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
                  <p className="text-sm text-red-400 mb-1">{matchResults.unmatched.length} not found:</p>
                  <div className="max-h-32 overflow-y-auto text-xs text-casino-gray mb-2">
                    {matchResults.unmatched.map((name, idx) => (
                      <div key={idx}>{name}</div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!selectedTournamentId || isAddingMissing}
                    onClick={handleAddMissing}
                  >
                    {isAddingMissing ? 'Adding…' : `Add ${matchResults.unmatched.length} to tournament field`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
