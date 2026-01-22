'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { logger } from '@/lib/logger';

interface UnifiedAuthFormProps {
  inviteCode?: string;
}

export function UnifiedAuthForm({ inviteCode }: UnifiedAuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const supabase = createClient();

      // Try to sign in first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // If invalid credentials, try to sign up (new user)
        if (signInError.message.includes('Invalid login credentials')) {
          logger.info('Sign in failed, attempting signup for new user');
          
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          });

          if (signUpError) {
            logger.error('Signup failed', { errorMessage: signUpError.message }, signUpError as Error);
            
            if (signUpError.message.includes('Email rate limit exceeded') || signUpError.message.toLowerCase().includes('rate limit')) {
              setError('Too many attempts. Please wait a few minutes and try again.');
            } else if (signUpError.message.includes('password')) {
              setError('Password must be at least 6 characters.');
            } else {
              setError(signUpError.message);
            }
            setIsLoading(false);
            return;
          }

          logger.info('Signup successful', { userId: signUpData.user?.id });

          // Show username modal for new user
          setUserId(signUpData.user?.id || null);
          setShowUsernameModal(true);
          setIsLoading(false);
          return;
        } else if (signInError.message.includes('Email rate limit exceeded') || signInError.message.toLowerCase().includes('rate limit')) {
          setError('Too many attempts. Please wait a few minutes and try again.');
        } else {
          setError(signInError.message);
        }
        setIsLoading(false);
        return;
      }

      // Sign in successful
      logger.info('Login successful', { userId: signInData.user?.id });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      const error = err as Error;
      logger.error('Unexpected error during auth', {}, error);
      setError(`An unexpected error occurred: ${error.message}`);
      setIsLoading(false);
    }
  };

  const handleSetUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      
      // Update user metadata with username
      const { error: updateError } = await supabase.auth.updateUser({
        data: { username },
      });

      if (updateError) {
        setError(updateError.message);
        setIsLoading(false);
        return;
      }

      // Update profile with username
      if (userId) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ username })
          .eq('id', userId);

        if (profileError) {
          logger.warn('Failed to update profile username', { error: profileError.message });
        }
      }

      logger.info('Username set successfully');
      
      // Redirect to appropriate page
      if (inviteCode) {
        router.push(`/invite/${inviteCode}`);
      } else {
        router.push('/dashboard');
      }
      router.refresh();
    } catch (err) {
      const error = err as Error;
      logger.error('Error setting username', {}, error);
      setError(`Failed to set username: ${error.message}`);
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Welcome to FORE!CAST</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-950/50 border border-red-800/50 rounded-lg mb-4">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 text-sm text-green-400 bg-green-950/50 border border-green-800/50 rounded-lg mb-4">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-casino-text mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 border border-casino-gold/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-casino-gold bg-casino-card text-casino-text placeholder:text-casino-gray"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-casino-text">
                  Password
                </label>
                <a
                  href="/auth/forgot-password"
                  className="text-xs text-casino-green hover:text-casino-gold font-medium transition-colors"
                >
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 pr-10 border border-casino-gold/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-casino-gold bg-casino-card text-casino-text placeholder:text-casino-gray"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-casino-gray hover:text-casino-gold transition-colors"
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
              <p className="mt-1 text-xs text-casino-gray">
                Minimum 6 characters
              </p>
            </div>

            <Button type="submit" isLoading={isLoading} className="w-full">
              Continue
            </Button>

            <div className="text-xs text-casino-gray text-center">
              <p>
                Sign in or create a new account - we'll figure it out automatically
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Username Modal */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Choose Your Username</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSetUsername} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-400 bg-red-950/50 border border-red-800/50 rounded-lg">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="modal-username" className="block text-sm font-medium text-casino-text mb-1">
                    Username
                  </label>
                  <input
                    id="modal-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-3 py-2 border border-casino-gold/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-casino-gold bg-casino-card text-casino-text placeholder:text-casino-gray"
                    placeholder="johndoe"
                  />
                  <p className="mt-1 text-xs text-casino-gray">
                    This will be your display name
                  </p>
                </div>

                <Button type="submit" isLoading={isLoading} className="w-full">
                  Continue to Dashboard
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
