'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';

export interface Profile {
  id: string;
  clerk_id: string;
  email: string;
  username: string;
  active_league_id: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get or create a profile for the current Clerk user.
 * This is the main helper for server-side auth.
 */
export async function getProfile(): Promise<Profile | null> {
  const { userId } = await auth();
  
  if (!userId) {
    return null;
  }

  const user = await currentUser();
  if (!user) {
    return null;
  }

  const supabase = createServiceClient();
  
  // Try to find existing profile by clerk_id
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_id', userId)
    .single();

  if (existingProfile) {
    return existingProfile as Profile;
  }

  // Create profile if it doesn't exist
  const email = user.emailAddresses?.[0]?.emailAddress || '';
  const username = user.username || user.firstName || email.split('@')[0];
  
  const { data: newProfile, error: createError } = await supabase
    .from('profiles')
    .insert({
      clerk_id: userId,
      email: email,
      username: username,
    })
    .select()
    .single();

  if (createError) {
    console.error('Error creating profile:', createError);
    return null;
  }

  return newProfile as Profile;
}

/**
 * Check if the current user is authenticated.
 * Returns the Clerk user ID if authenticated, null otherwise.
 */
export async function getClerkUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}
