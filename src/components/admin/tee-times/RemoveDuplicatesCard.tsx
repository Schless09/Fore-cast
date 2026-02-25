'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Tournament {
  id: string;
  name: string;
  start_date: string;
  status: string;
}

export function RemoveDuplicatesCard({
  tournaments,
  selectedTournamentId,
  onTournamentChange,
}: {
  tournaments: Tournament[];
  selectedTournamentId: string;
  onTournamentChange: (id: string) => void;
}) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastResult, setLastResult] = useState<{ removed: number; duplicates: { name: string; canonicalName: string }[] } | null>(null);

  async function handleRemoveDuplicates() {
    if (!selectedTournamentId) {
      setMessage({ type: 'error', text: 'Select a tournament first' });
      return;
    }
    setIsRemoving(true);
    setMessage(null);
    setLastResult(null);
    try {
      const res = await fetch('/api/admin/tournament-players/remove-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: selectedTournamentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to remove duplicates' });
        return;
      }
      setMessage({ type: 'success', text: data.message ?? 'Done' });
      setLastResult({ removed: data.removed ?? 0, duplicates: data.duplicates ?? [] });
    } catch (e: unknown) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to remove duplicates' });
    } finally {
      setIsRemoving(false);
    }
  }

  const upcoming = tournaments.filter((t) => t.status === 'upcoming');

  return (
    <Card className="border-amber-200/50 bg-casino-dark/30">
      <CardHeader>
        <CardTitle className="text-casino-gold">Remove CBS Duplicates</CardTitle>
        <p className="text-sm text-casino-gray mt-1">
          CBS sync sometimes adds players at $2.50 when they&apos;re already in the field (name spelling
          mismatch: Højgaard vs Hojgaard, Matti vs Matthias, etc.). This removes those duplicates.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedTournamentId}
            onChange={(e) => onTournamentChange(e.target.value)}
            className="bg-casino-dark border border-casino-gold/30 rounded px-3 py-1.5 text-casino-text"
          >
            <option value="">Select tournament</option>
            {(upcoming.length ? upcoming : tournaments).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.start_date})
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={handleRemoveDuplicates}
            disabled={!selectedTournamentId || isRemoving}
            className="text-amber-400 border-amber-400/50 hover:bg-amber-400/10"
          >
            {isRemoving ? 'Removing…' : 'Remove Duplicates'}
          </Button>
        </div>
        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}
        {lastResult && lastResult.duplicates.length > 0 && (
          <div className="text-sm text-casino-gray">
            Removed: {lastResult.duplicates.map((d) => `${d.name} → ${d.canonicalName}`).join(', ')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
