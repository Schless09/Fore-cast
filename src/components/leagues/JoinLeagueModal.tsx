'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { joinLeague } from '@/lib/actions/league';

interface JoinLeagueModalProps {
  onClose?: () => void;
  canClose?: boolean;
}

export function JoinLeagueModal({ onClose, canClose = false }: JoinLeagueModalProps) {
  const [leagueName, setLeagueName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await joinLeague(leagueName.trim(), password.trim());

      if (!result.success) {
        setError(result.error || 'Failed to join league');
        setLoading(false);
        return;
      }

      // Success! Refresh the page to update the UI
      router.refresh();
      if (onClose) onClose();
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Join a League</CardTitle>
            {canClose && onClose && (
              <button
                onClick={onClose}
                className="text-casino-gray hover:text-casino-text transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </div>
          <p className="text-sm text-casino-gray mt-2">
            Enter your league name and password to join your group
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="leagueName" className="block text-sm font-medium text-casino-text mb-2">
                League Name
              </label>
              <input
                id="leagueName"
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                placeholder="e.g., BamaBoys2026"
                required
                className="w-full px-4 py-2 bg-casino-card border border-casino-gold/30 rounded-lg text-casino-text placeholder-casino-gray/50 focus:outline-none focus:ring-2 focus:ring-casino-gold focus:border-casino-gold"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-casino-text mb-2">
                League Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter league password"
                required
                className="w-full px-4 py-2 bg-casino-card border border-casino-gold/30 rounded-lg text-casino-text placeholder-casino-gray/50 focus:outline-none focus:ring-2 focus:ring-casino-gold focus:border-casino-gold"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-casino-gold"
            >
              {loading ? 'Joining...' : 'Join League'}
            </Button>

            {!canClose && (
              <p className="text-xs text-casino-gray text-center mt-4">
                You must join a league to continue
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
