'use server';

import { createClient } from '@/lib/supabase/server';

export async function createLeague(leagueName: string, password: string) {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Validate league name
  if (!leagueName || leagueName.trim().length < 3) {
    return { success: false, error: 'League name must be at least 3 characters' };
  }

  if (!password || password.trim().length < 4) {
    return { success: false, error: 'Password must be at least 4 characters' };
  }

  // Check if league name already exists
  const { data: existingLeague } = await supabase
    .from('leagues')
    .select('id')
    .eq('name', leagueName.trim())
    .single();

  if (existingLeague) {
    return { success: false, error: 'League name already taken' };
  }

  // Create the league
  const { data: newLeague, error: createError } = await supabase
    .from('leagues')
    .insert({ name: leagueName.trim(), password: password.trim() })
    .select('id, name')
    .single();

  if (createError || !newLeague) {
    return { success: false, error: 'Failed to create league' };
  }

  // Add the creator to the league
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ league_id: newLeague.id })
    .eq('id', user.id);

  if (updateError) {
    return { success: false, error: 'Failed to join created league' };
  }

  return { success: true, leagueName: newLeague.name };
}

export async function joinLeague(leagueName: string, password: string) {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Find the league by name
  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select('id, name, password')
    .eq('name', leagueName)
    .single();

  if (leagueError || !league) {
    return { success: false, error: 'League not found' };
  }

  // Verify password
  if (league.password !== password) {
    return { success: false, error: 'Incorrect password' };
  }

  // Update user's profile with league_id
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ league_id: league.id })
    .eq('id', user.id);

  if (updateError) {
    return { success: false, error: 'Failed to join league' };
  }

  return { success: true, leagueName: league.name };
}

export async function checkUserLeague() {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { hasLeague: false, leagueName: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('league_id, league:leagues(name)')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.league_id) {
    return { hasLeague: false, leagueName: null };
  }

  return { 
    hasLeague: true, 
    leagueName: (profile.league as any)?.name || null 
  };
}
