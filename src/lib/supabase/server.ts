import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const error = new Error('Missing Supabase environment variables');
    logger.error('Failed to create Supabase server client', {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
    }, error);
    throw error;
  }

  if (supabaseAnonKey.includes('your_') || supabaseAnonKey.includes('_here')) {
    const error = new Error('Supabase anon key appears to be a placeholder');
    logger.error('Invalid Supabase anon key in server client', {
      anonKeyPreview: supabaseAnonKey.substring(0, 20),
    }, error);
    throw error;
  }

  const cookieStore = await cookies();

  try {
    const client = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            logger.debug('Cookie setAll called from Server Component (expected)', {
              cookieCount: cookiesToSet.length,
            });
          }
        },
      },
    });
    logger.debug('Supabase server client created successfully');
    return client;
  } catch (error) {
    logger.error('Failed to create Supabase server client', {}, error as Error);
    throw error;
  }
}
