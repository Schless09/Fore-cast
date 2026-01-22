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

  // Add the creator to the league_members table
  const { error: memberError } = await supabase
    .from('league_members')
    .insert({ 
      user_id: user.id, 
      league_id: newLeague.id,
      is_active: true 
    });

  if (memberError) {
    return { success: false, error: 'Failed to join created league' };
  }

  // Set this as their active league
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ active_league_id: newLeague.id })
    .eq('id', user.id);

  if (updateError) {
    return { success: false, error: 'Failed to set active league' };
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

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('league_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('league_id', league.id)
    .single();

  if (existingMember) {
    // Already a member, just set as active
    await supabase
      .from('profiles')
      .update({ active_league_id: league.id })
      .eq('id', user.id);
    
    return { success: true, leagueName: league.name };
  }

  // Add user to league_members
  const { error: memberError } = await supabase
    .from('league_members')
    .insert({ 
      user_id: user.id, 
      league_id: league.id,
      is_active: true 
    });

  if (memberError) {
    return { success: false, error: 'Failed to join league' };
  }

  // Set as active league
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ active_league_id: league.id })
    .eq('id', user.id);

  if (updateError) {
    return { success: false, error: 'Failed to set active league' };
  }

  return { success: true, leagueName: league.name };
}

export async function checkUserLeague() {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { hasLeague: false, leagueName: null, leagues: [] };
  }

  // Get all leagues user is a member of
  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id, leagues(id, name)')
    .eq('user_id', user.id);

  if (!memberships || memberships.length === 0) {
    return { hasLeague: false, leagueName: null, leagues: [] };
  }

  // Get active league
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_league_id')
    .eq('id', user.id)
    .single();

  const activeLeague = memberships.find(
    m => (m.leagues as any)?.id === profile?.active_league_id
  );

  return { 
    hasLeague: true, 
    leagueName: (activeLeague?.leagues as any)?.name || (memberships[0].leagues as any)?.name,
    leagues: memberships.map(m => (m.leagues as any))
  };
}

export async function getUserLeagues() {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { leagues: [], activeLeagueId: null };
  }

  // Get all leagues user is a member of
  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id, joined_at, leagues(id, name)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });

  // Get active league
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_league_id')
    .eq('id', user.id)
    .single();

  return {
    leagues: memberships?.map(m => ({
      id: (m.leagues as any)?.id,
      name: (m.leagues as any)?.name,
      joined_at: m.joined_at
    })) || [],
    activeLeagueId: profile?.active_league_id || null
  };
}

export async function switchLeague(leagueId: string) {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Verify user is a member of this league
  const { data: membership } = await supabase
    .from('league_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('league_id', leagueId)
    .single();

  if (!membership) {
    return { success: false, error: 'Not a member of this league' };
  }

  // Update active league
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ active_league_id: leagueId })
    .eq('id', user.id);

  if (updateError) {
    return { success: false, error: 'Failed to switch league' };
  }

  return { success: true };
}

export async function leaveLeague(leagueId: string) {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Delete membership
  const { error: deleteError } = await supabase
    .from('league_members')
    .delete()
    .eq('user_id', user.id)
    .eq('league_id', leagueId);

  if (deleteError) {
    return { success: false, error: 'Failed to leave league' };
  }

  // If this was active league, switch to another one
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_league_id')
    .eq('id', user.id)
    .single();

  if (profile?.active_league_id === leagueId) {
    // Get another league to switch to
    const { data: otherLeagues } = await supabase
      .from('league_members')
      .select('league_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (otherLeagues) {
      await supabase
        .from('profiles')
        .update({ active_league_id: otherLeagues.league_id })
        .eq('id', user.id);
    } else {
      // No other leagues, set to null
      await supabase
        .from('profiles')
        .update({ active_league_id: null })
        .eq('id', user.id);
    }
  }

  return { success: true };
}
