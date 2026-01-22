import { createBrowserClient } from '@supabase/ssr';
import { logger } from '@/lib/logger';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    logger.error('Missing Supabase environment variables', {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      urlValue: supabaseUrl || 'MISSING',
      anonKeyValue: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'MISSING',
    });
    // Don't throw - let the app continue but Supabase calls will fail
    // This allows the user to see helpful error messages in the UI
  }

  if (supabaseAnonKey && (supabaseAnonKey.includes('your_') || supabaseAnonKey.includes('_here'))) {
    logger.error('Supabase anon key appears to be a placeholder', {
      anonKeyPreview: supabaseAnonKey.substring(0, 20),
      help: 'Please update NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env or .env.local file with your actual Supabase anon key from the Supabase dashboard.',
    });
    // Don't throw - log the error but allow the app to continue
    // The actual API calls will fail with helpful error messages
  }

  // Only create client if we have valid values
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client that will fail gracefully
    // This prevents the app from crashing but API calls will show errors
    logger.warn('Creating Supabase client with missing environment variables - API calls will fail');
  }

  try {
    const client = createBrowserClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-key'
    );
    logger.debug('Supabase client created', {
      url: supabaseUrl || 'PLACEHOLDER',
      hasValidKey: !supabaseAnonKey?.includes('your_') && !supabaseAnonKey?.includes('_here'),
    });
    return client;
  } catch (error) {
    logger.error('Failed to create Supabase client', {
      url: supabaseUrl,
    }, error as Error);
    // Still return a client - let individual API calls handle the errors
    return createBrowserClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-key'
    );
  }
}
