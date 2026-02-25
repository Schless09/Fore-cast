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
  withdrawnPlayerNames?: string[];
}

export function CheckAndClearTeeTimesCard() {
  const [teeTimeCheck, setTeeTimeCheck] = useState<TeeTimeCheckResult[] | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncDetails, setSyncDetails] = useState<{
    message: string;
    details?: unknown[];
    diagnostic?: {
      cognizantTournaments: { id: string; name: string; start_date: string; count: number }[];
      inWindowIds: string[];
      hint?: string;
    };
  } | null>(null);
  const [cbsDebug, setCbsDebug] = useState<{
    rowsParsed: number;
    htmlLength: number;
    hasCellPlayerNameLong: boolean;
    sampleNames: string[];
  } | null>(null);
  const [isDebugging, setIsDebugging] = useState(false);

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

  async function handleCbsDebug() {
    setIsDebugging(true);
    setCbsDebug(null);
    try {
      const res = await fetch('/api/admin/tee-times/cbs-debug');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Debug failed' });
        return;
      }
      setCbsDebug({
        rowsParsed: data.rowsParsed ?? 0,
        htmlLength: data.htmlLength ?? 0,
        hasCellPlayerNameLong: data.hasCellPlayerNameLong ?? false,
        sampleNames: data.sampleNames ?? [],
      });
      setMessage({
        type: data.rowsParsed >= 50 ? 'success' : 'error',
        text: `CBS: ${data.rowsParsed} rows, ${data.htmlLength} bytes. CellPlayerName--long: ${data.hasCellPlayerNameLong ? 'yes' : 'no'}. Sample: ${(data.sampleNames ?? []).slice(0, 3).join(', ')}`,
      });
    } catch (e: unknown) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Debug failed' });
    } finally {
      setIsDebugging(false);
    }
  }

  async function handleSyncFromCBS() {
    setIsSyncing(true);
    setMessage(null);
    setSyncDetails(null);
    try {
      const res = await fetch('/api/admin/tee-times/sync-from-cbs', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to sync from CBS' });
        return;
      }
      setMessage({ type: 'success', text: data.message ?? 'Sync complete' });
      setSyncDetails({
        message: data.message,
        details: data.details,
        diagnostic: data.diagnostic,
      });
      setTeeTimeCheck(null); // Refresh would need another Check
    } catch (e: unknown) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to sync' });
    } finally {
      setIsSyncing(false);
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
        <div className="flex flex-wrap gap-2 mb-4">
          <Button onClick={handleCheck} disabled={isChecking} variant="outline">
            {isChecking ? 'Checking…' : 'Check Upcoming'}
          </Button>
          <Button onClick={handleSyncFromCBS} disabled={isSyncing} variant="primary">
            {isSyncing ? 'Syncing…' : 'Sync from CBS Now'}
          </Button>
          <Button onClick={handleCbsDebug} disabled={isDebugging} variant="ghost" size="sm">
            {isDebugging ? '…' : 'Debug CBS'}
          </Button>
        </div>
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
                  {t.withdrawnPlayerNames && t.withdrawnPlayerNames.length > 0 && (
                    <span className="text-sm text-amber-400" title={t.withdrawnPlayerNames.join(', ')}>
                      WD: {t.withdrawnPlayerNames.join(', ')}
                    </span>
                  )}
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
        {teeTimeCheck && teeTimeCheck.length === 0 && !syncDetails && (
          <p className="text-sm text-casino-gray">No upcoming tournaments in the next 7 days.</p>
        )}
        {syncDetails?.diagnostic?.cognizantTournaments && syncDetails.diagnostic.cognizantTournaments.length > 0 && (
          <div className="mt-4 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg text-sm">
            <p className="font-medium text-amber-400 mb-2">Tournament diagnostic (Cognizant):</p>
            {syncDetails.diagnostic.cognizantTournaments.map((t) => (
              <div key={t.id} className="text-casino-gray mb-1">
                {t.name} ({t.start_date}) — ID: {t.id.slice(0, 8)}… — <strong>{t.count} players</strong>
                {syncDetails.diagnostic?.inWindowIds.includes(t.id) && (
                  <span className="text-casino-green ml-1">• in sync window</span>
                )}
              </div>
            ))}
            {syncDetails.diagnostic.hint && (
              <p className="text-amber-400/90 mt-2">{syncDetails.diagnostic.hint}</p>
            )}
          </div>
        )}
        {syncDetails?.details && syncDetails.details.length > 0 && (
          <div className="mt-4 p-3 bg-casino-dark/50 rounded-lg text-sm space-y-2">
            {(syncDetails.details as {
              tournament: string;
              message?: string;
              skipped?: string;
              withdrawnPlayerNames?: string[];
              debug?: {
                cbsRows: number;
                matched: number;
                totalDb: number;
                matchRatePct: number;
                tournamentId?: string;
                countQueryResult?: number | null;
                selectError?: string | null;
              };
            }[]).map((d, i) => (
              <div key={i}>
                <span className="font-medium text-casino-text">{d.tournament}:</span>{' '}
                <span className="text-casino-gray">{d.message}</span>
                {d.skipped && <span className="text-amber-400 ml-1">({d.skipped})</span>}
                {d.withdrawnPlayerNames && d.withdrawnPlayerNames.length > 0 && (
                  <div className="mt-1 ml-4 text-amber-400">
                    <span className="font-medium">No longer in field:</span>{' '}
                    {d.withdrawnPlayerNames.join(', ')}
                  </div>
                )}
                {d.debug && (
                  <div className="text-xs text-casino-gray mt-1 ml-4">
                    CBS rows: {d.debug.cbsRows} | Matched: {d.debug.matched}/{d.debug.totalDb} ({d.debug.matchRatePct}%)
                    {d.debug.tournamentId != null && (
                      <div className="mt-1">
                        Sync used tournament ID: {String(d.debug.tournamentId).slice(0, 8)}… | Count query: {d.debug.countQueryResult ?? '?'}
                        {d.debug.selectError && ` | Select error: ${d.debug.selectError}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
