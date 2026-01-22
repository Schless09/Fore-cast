'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * Client-side error handler that catches unhandled errors and promise rejections
 * This helps catch errors like the page-events.js error
 */
export function ErrorHandler() {
  useEffect(() => {
    // Handle unhandled JavaScript errors
    const handleError = (event: ErrorEvent) => {
      logger.error('Unhandled JavaScript error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.name,
      }, event.error);

      // Prevent default error handling (browser console)
      // We've already logged it, but you might want to show a toast notification
    };

    // Handle unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      logger.error('Unhandled promise rejection', {
        reason: event.reason,
        type: typeof event.reason,
      }, event.reason instanceof Error ? event.reason : new Error(String(event.reason)));

      // Prevent default unhandled rejection warning
      event.preventDefault();
    };

    // Add event listeners
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Validate environment variables on client side (non-blocking)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.warn('Missing Supabase environment variables on client', {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
        help: 'Visit /env-check to verify your setup. Update your .env or .env.local file with the correct values.',
      });
    } else if (supabaseAnonKey.includes('your_') || supabaseAnonKey.includes('_here')) {
      logger.warn('Supabase anon key appears to be a placeholder', {
        anonKeyPreview: supabaseAnonKey.substring(0, 20),
        help: 'Please update NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env or .env.local file. Visit /env-check for help.',
      });
    } else {
      logger.debug('Supabase environment variables validated on client', {
        url: supabaseUrl,
        hasAnonKey: true,
      });
    }

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
