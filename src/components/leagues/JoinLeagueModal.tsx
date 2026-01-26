'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface JoinLeagueModalProps {
  onClose?: () => void;
  canClose?: boolean;
}

export function JoinLeagueModal({ onClose, canClose = false }: JoinLeagueModalProps) {
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [leagueName, setLeagueName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'create' ? '/api/leagues/create' : '/api/leagues/join';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leagueName: leagueName.trim(),
          password: password.trim(),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || `Failed to ${mode} league`);
        setLoading(false);
        return;
      }

      // Success! Redirect to dashboard
      if (onClose) onClose();
      router.push('/the-money-board');
      router.refresh();
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setError('An unexpected error occurred. Please try again.');
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
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'join' ? 'Enter league password' : 'Create a password for your league'}
                  required
                  minLength={4}
                  className="w-full px-4 py-2 pr-10 bg-casino-card border border-casino-gold/30 rounded-lg text-casino-text placeholder-casino-gray/50 focus:outline-none focus:ring-2 focus:ring-casino-gold focus:border-casino-gold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-casino-gray hover:text-casino-text transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
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
