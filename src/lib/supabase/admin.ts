import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase admin client using the service role key.
 * This bypasses RLS and should only be used in server-side code
 * where we've already verified the user via Clerk.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get or create a profile for a Clerk user.
 * This ensures every Clerk user has a corresponding profile in Supabase.
 */
export async function getOrCreateProfile(clerkUserId: string, email: string, username?: string) {
  const supabase = createAdminClient();

  // First try to get existing profile
  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_id', clerkUserId)
    .single();

  if (existingProfile) {
    return { profile: existingProfile, isNew: false };
  }

  // Profile doesn't exist, create one
  const displayName = username || email.split('@')[0];
  
  const { data: newProfile, error: createError } = await supabase
    .from('profiles')
    .insert({
      clerk_id: clerkUserId,
      email: email,
      username: displayName,
    })
    .select()
    .single();

  if (createError) {
    console.error('Error creating profile:', createError);
    throw new Error('Failed to create profile');
  }

  return { profile: newProfile, isNew: true };
}
