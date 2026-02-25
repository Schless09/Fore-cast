'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface TeeTimeCheckResult {
  id: string;
  name: string;
  start_date: string;
  withTeeTimes: number;
  total: number;
}

export function CheckAndClearTeeTimesCard() {
  const [teeTimeCheck, setTeeTimeCheck] = useState<TeeTimeCheckResult[] | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleCheck() {
    setIsChecking(true);
    setTeeTimeCheck(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/tee-times/check-and-clear');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to check tee times' });
        return;
      }
      setTeeTimeCheck(data.upcomingTournaments ?? []);
      if ((data.upcomingTournaments ?? []).length > 0) {
        setMessage({ type: 'success', text: data.message });
      }
    } catch (e: unknown) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to check' });
    } finally {
      setIsChecking(false);
    }
  }

  async function handleClear(tournamentId: string) {
    setIsClearing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/tee-times/check-and-clear', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to clear tee times' });
        return;
      }
      setMessage({
        type: 'success',
        text: data.message ?? `Cleared tee times for ${data.cleared ?? 0} players`,
      });
      setTeeTimeCheck(null);
    } catch (e: unknown) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to clear' });
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Check & Clear Tee Times (CBS Sync Test)</CardTitle>
        <p className="text-sm text-casino-gray mt-1">
          Check upcoming tournaments for existing tee times. Clear them to verify CBS cron populates correctly.
        </p>
      </CardHeader>
      <CardContent>
        <Button onClick={handleCheck} disabled={isChecking} variant="outline" className="mb-4">
          {isChecking ? 'Checking…' : 'Check Upcoming Tournaments'}
        </Button>
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
        {teeTimeCheck && teeTimeCheck.length > 0 && (
          <div className="space-y-2">
            {teeTimeCheck.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-4 p-3 bg-casino-dark/50 rounded-lg"
              >
                <div>
                  <span className="font-medium text-casino-text">{t.name}</span>
                  <span className="text-casino-gray text-sm ml-2">
                    ({new Date(t.start_date).toLocaleDateString()})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-casino-gray">
                    {t.withTeeTimes} / {t.total} with tee times
                  </span>
                  {t.withTeeTimes > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClear(t.id)}
                      disabled={isClearing}
                      className="text-amber-400 border-amber-400/50 hover:bg-amber-400/10"
                    >
                      {isClearing ? 'Clearing…' : 'Clear Tee Times'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {teeTimeCheck && teeTimeCheck.length === 0 && (
          <p className="text-sm text-casino-gray">No upcoming tournaments in the next 7 days.</p>
        )}
      </CardContent>
    </Card>
  );
}
