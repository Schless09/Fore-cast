'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { logger } from '@/lib/logger';

export function SignupForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    logger.info('Signup attempt started', {
      email: email.substring(0, 5) + '***', // Log partial email for privacy
      hasUsername: !!username,
    });

    try {
      const supabase = createClient();
      
      logger.debug('Supabase client created, attempting signup', {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      });

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (signUpError) {
        logger.error('Signup failed', {
          errorCode: signUpError.status,
          errorMessage: signUpError.message,
          email: email.substring(0, 5) + '***',
        }, signUpError as Error);
        
        // Provide more helpful error messages
        let errorMessage = signUpError.message;
        if (signUpError.message.includes('API key')) {
          errorMessage = 'Configuration error: Invalid API key. Please check your environment variables.';
        } else if (signUpError.message.includes('email')) {
          errorMessage = 'Invalid email address or email already in use.';
        } else if (signUpError.message.includes('password')) {
          errorMessage = 'Password does not meet requirements.';
        }
        
        setError(errorMessage);
        setIsLoading(false);
        return;
      }

      logger.info('Signup successful', {
        userId: signUpData.user?.id,
        emailConfirmed: !!signUpData.user?.email_confirmed_at,
      });

      // Check if user is immediately signed in (email confirmation disabled)
      // or if email confirmation is required
      const { data: { user }, error: getUserError } = await supabase.auth.getUser();
      
      if (getUserError) {
        logger.warn('Failed to get user after signup', {
          error: getUserError.message,
        });
      }
      
      if (user) {
        // User is immediately signed in (email confirmation disabled)
        // Profile will be created automatically via trigger
        logger.info('User immediately signed in, redirecting to dashboard');
        router.push('/dashboard');
        router.refresh();
      } else {
        // Email confirmation required - show success message
        logger.info('Email confirmation required');
        setError(null);
        setMessage('Account created! Please check your email to confirm your account before signing in.');
        // Don't redirect, let user see the message
      }
    } catch (err) {
      const error = err as Error;
      logger.error('Unexpected error during signup', {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack,
      }, error);
      
      setError(`An unexpected error occurred: ${error.message}. Please check the console for details.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 text-sm text-green-600 bg-green-50 rounded-lg">
              {message}
            </div>
          )}

          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder:text-gray-400 bg-white"
              placeholder="johndoe"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder:text-gray-400 bg-white"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder:text-gray-400 bg-white"
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-gray-500">
              Must be at least 6 characters
            </p>
          </div>

          <Button type="submit" isLoading={isLoading} className="w-full">
            Create Account
          </Button>

          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a
              href="/auth/login"
              className="text-green-600 hover:text-green-700 font-medium"
            >
              Sign in
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
