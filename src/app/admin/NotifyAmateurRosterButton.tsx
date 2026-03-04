'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function NotifyAmateurRosterButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    emailsSent?: number;
    recipientCount?: number;
    debug?: Record<string, unknown>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/notify-amateur-roster', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Request failed');
        return;
      }
      setResult({
        message: data.message,
        emailsSent: data.emailsSent,
        recipientCount: data.recipientCount,
        debug: data.debug,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="text-base">One-off: Daniel Bennett amateur notice</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-gray-600 text-sm">
          Email everyone who has Daniel Bennett on their roster for this week’s tournament (amateur — remove him).
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSend}
          disabled={loading}
          className="border-amber-400 text-amber-800 hover:bg-amber-100"
        >
          {loading ? 'Sending…' : 'Send emails'}
        </Button>
        {result && (
          <div className="space-y-1">
            <p className="text-sm text-green-700">
              {result.message}
              {result.emailsSent != null && ` (${result.emailsSent} sent)`}
            </p>
            {result.emailsSent === 0 && result.debug && (
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40 text-gray-700 mt-2">
                {JSON.stringify(result.debug, null, 2)}
              </pre>
            )}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
