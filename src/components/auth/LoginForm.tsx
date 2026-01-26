'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { logger } from '@/lib/logger';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    logger.info('Login attempt started', {
      email: email.substring(0, 5) + '***',
    });

    try {
      const supabase = createClient();
      
      logger.debug('Supabase client created, attempting login');

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        logger.error('Login failed', {
          errorCode: signInError.status,
          errorMessage: signInError.message,
          email: email.substring(0, 5) + '***',
        }, signInError as Error);
        
        // Provide more helpful error messages
        let errorMessage = signInError.message;
        if (signInError.message.includes('API key')) {
          errorMessage = 'Configuration error: Invalid API key. Please check your environment variables.';
        } else if (signInError.message.includes('Invalid login')) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (signInError.message.includes('Email not confirmed')) {
          errorMessage = 'Please confirm your email address before signing in.';
        }
        
        setError(errorMessage);
        return;
      }

      logger.info('Login successful', {
        userId: signInData.user?.id,
      });

      router.push('/the-money-board');
      router.refresh();
    } catch (err) {
      const error = err as Error;
      logger.error('Unexpected error during login', {
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
        <CardTitle>Sign In</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

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
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <a
                href="/auth/forgot-password"
                className="text-xs text-green-600 hover:text-green-700 font-medium"
              >
                Forgot password?
              </a>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder:text-gray-400 bg-white"
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" isLoading={isLoading} className="w-full">
            Sign In
          </Button>

          <p className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <a
              href="/auth/signup"
              className="text-green-600 hover:text-green-700 font-medium"
            >
              Sign up
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
