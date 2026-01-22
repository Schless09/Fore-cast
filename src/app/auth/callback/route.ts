import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Handle Supabase auth callbacks (email confirmation, password reset, etc.)
 * This route handles the `code` parameter from email links
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = await createClient();
    
    try {
      logger.info('Processing auth callback', {
        hasCode: !!code,
        redirectTo: next,
      });

      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        logger.error('Failed to exchange code for session', {
          errorMessage: error.message,
          errorStatus: error.status,
        }, error as Error);
        
        // Redirect to login with error message
        const loginUrl = new URL('/auth/login', requestUrl.origin);
        loginUrl.searchParams.set('error', 'Invalid or expired confirmation link');
        return NextResponse.redirect(loginUrl);
      }

      if (data.session) {
        logger.info('Email confirmation successful', {
          userId: data.user?.id,
          email: data.user?.email,
        });

        // Redirect to dashboard (or next parameter) with success message
        const redirectUrl = new URL(next, requestUrl.origin);
        redirectUrl.searchParams.set('message', 'Email confirmed successfully! You are now signed in.');
        return NextResponse.redirect(redirectUrl);
      }

      // If no session, redirect to login
      logger.warn('No session after code exchange', {
        hasUser: !!data.user,
      });
      return NextResponse.redirect(new URL('/auth/login', requestUrl.origin));
    } catch (error) {
      logger.error('Unexpected error in auth callback', {}, error as Error);
      const loginUrl = new URL('/auth/login', requestUrl.origin);
      loginUrl.searchParams.set('error', 'An error occurred during confirmation');
      return NextResponse.redirect(loginUrl);
    }
  }

  // No code parameter, redirect to home
  return NextResponse.redirect(new URL('/', requestUrl.origin));
}
