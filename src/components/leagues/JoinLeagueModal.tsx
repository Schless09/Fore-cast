'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { joinLeague, createLeague } from '@/lib/actions/league';

interface JoinLeagueModalProps {
  onClose?: () => void;
  canClose?: boolean;
}

export function JoinLeagueModal({ onClose, canClose = false }: JoinLeagueModalProps) {
  const [mode, setMode] = useState<'join' | 'create'>('join');
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
      const result = mode === 'create' 
        ? await createLeague(leagueName.trim(), password.trim())
        : await joinLeague(leagueName.trim(), password.trim());

      if (!result.success) {
        setError(result.error || `Failed to ${mode} league`);
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

  const toggleMode = () => {
    setMode(mode === 'join' ? 'create' : 'join');
    setError('');
    setLeagueName('');
    setPassword('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">
              {mode === 'join' ? 'Join a League' : 'Create a League'}
            </CardTitle>
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
            {mode === 'join' 
              ? 'Enter your league name and password to join your group'
              : 'Create a new league for your friend group'}
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
                placeholder={mode === 'join' ? 'e.g., BamaBoys2026' : 'Choose a unique league name'}
                required
                minLength={3}
                className="w-full px-4 py-2 bg-casino-card border border-casino-gold/30 rounded-lg text-casino-text placeholder-casino-gray/50 focus:outline-none focus:ring-2 focus:ring-casino-gold focus:border-casino-gold"
              />
              {mode === 'create' && (
                <p className="text-xs text-casino-gray mt-1">Minimum 3 characters</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-casino-text mb-2">
                {mode === 'join' ? 'League Password' : 'Set Password'}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'join' ? 'Enter league password' : 'Create a password for your league'}
                required
                minLength={4}
                className="w-full px-4 py-2 bg-casino-card border border-casino-gold/30 rounded-lg text-casino-text placeholder-casino-gray/50 focus:outline-none focus:ring-2 focus:ring-casino-gold focus:border-casino-gold"
              />
              {mode === 'create' && (
                <p className="text-xs text-casino-gray mt-1">Minimum 4 characters. Share this with your friends!</p>
              )}
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
              {loading 
                ? (mode === 'join' ? 'Joining...' : 'Creating...') 
                : (mode === 'join' ? 'Join League' : 'Create League')}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-casino-gold hover:text-casino-gold-light transition-colors"
              >
                {mode === 'join' 
                  ? "Don't have a league? Create one" 
                  : 'Already have a league? Join it'}
              </button>
            </div>

            {!canClose && (
              <p className="text-xs text-casino-gray text-center">
                You must {mode === 'join' ? 'join' : 'create'} a league to continue
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
