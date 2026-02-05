'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';

async function getProfileForClerkUser() {
  const { userId } = await auth();
  
  if (!userId) {
    return { profile: null, error: 'Not authenticated' };
  }

  const user = await currentUser();
  if (!user) {
    return { profile: null, error: 'User not found' };
  }

  const supabase = createServiceClient();
  
  // Try to find existing profile by clerk_id
  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_id', userId)
    .single();

  if (existingProfile) {
    return { profile: existingProfile, error: null };
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
    return { profile: null, error: 'Failed to create profile' };
  }

  return { profile: newProfile, error: null };
}

export async function createLeague(leagueName: string, password: string) {
  const { profile, error: authError } = await getProfileForClerkUser();
  
  if (authError || !profile) {
    return { 
      success: false, 
      error: authError || 'Authentication failed. Please try refreshing the page.' 
    };
  }

  const supabase = createServiceClient();

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
      user_id: profile.id, 
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
    .eq('id', profile.id);

  if (updateError) {
    return { success: false, error: 'Failed to set active league' };
  }

  return { success: true, leagueName: newLeague.name };
}

export async function joinLeague(leagueName: string, password: string) {
  const { profile, error: authError } = await getProfileForClerkUser();
  
  if (authError || !profile) {
    return { 
      success: false, 
      error: authError || 'Authentication failed. Please try refreshing the page.' 
    };
  }

  const supabase = createServiceClient();

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
    .eq('user_id', profile.id)
    .eq('league_id', league.id)
    .single();

  if (existingMember) {
    // Already a member, just set as active
    await supabase
      .from('profiles')
      .update({ active_league_id: league.id })
      .eq('id', profile.id);
    
    return { success: true, leagueName: league.name };
  }

  // Add user to league_members
  const { error: memberError } = await supabase
    .from('league_members')
    .insert({ 
      user_id: profile.id, 
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
    .eq('id', profile.id);

  if (updateError) {
    return { success: false, error: 'Failed to set active league' };
  }

  return { success: true, leagueName: league.name };
}

export async function checkUserLeague() {
  const { profile, error: authError } = await getProfileForClerkUser();
  
  if (authError || !profile) {
    return { isAuthenticated: false, hasLeague: false, leagueName: null, leagues: [] };
  }

  const supabase = createServiceClient();

  // Get all leagues user is a member of
  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id, leagues(id, name)')
    .eq('user_id', profile.id);

  if (!memberships || memberships.length === 0) {
    return { isAuthenticated: true, hasLeague: false, leagueName: null, leagues: [] };
  }

  const activeLeague = memberships.find(
    m => (m.leagues as any)?.id === profile.active_league_id
  );

  return { 
    isAuthenticated: true,
    hasLeague: true, 
    leagueName: (activeLeague?.leagues as any)?.name || (memberships[0].leagues as any)?.name,
    leagues: memberships.map(m => (m.leagues as any))
  };
}

export async function getUserLeagues() {
  const { profile, error: authError } = await getProfileForClerkUser();
  
  if (authError || !profile) {
    return { leagues: [], activeLeagueId: null };
  }

  const supabase = createServiceClient();

  // Get all leagues user is a member of
  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id, joined_at, leagues(id, name)')
    .eq('user_id', profile.id)
    .order('joined_at', { ascending: false });

  return {
    leagues: memberships?.map(m => ({
      id: (m.leagues as any)?.id,
      name: (m.leagues as any)?.name,
      joined_at: m.joined_at
    })) || [],
    activeLeagueId: profile.active_league_id || null
  };
}

export async function switchLeague(leagueId: string) {
  const { profile, error: authError } = await getProfileForClerkUser();
  
  if (authError || !profile) {
    return { success: false, error: 'Not authenticated' };
  }

  const supabase = createServiceClient();

  // Verify user is a member of this league
  const { data: membership } = await supabase
    .from('league_members')
    .select('id')
    .eq('user_id', profile.id)
    .eq('league_id', leagueId)
    .single();

  if (!membership) {
    return { success: false, error: 'Not a member of this league' };
  }

  // Update active league
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ active_league_id: leagueId })
    .eq('id', profile.id);

  if (updateError) {
    return { success: false, error: 'Failed to switch league' };
  }

  return { success: true };
}

export async function leaveLeague(leagueId: string) {
  const { profile, error: authError } = await getProfileForClerkUser();
  
  if (authError || !profile) {
    return { success: false, error: 'Not authenticated' };
  }

  const supabase = createServiceClient();

  // Delete membership
  const { error: deleteError } = await supabase
    .from('league_members')
    .delete()
    .eq('user_id', profile.id)
    .eq('league_id', leagueId);

  if (deleteError) {
    return { success: false, error: 'Failed to leave league' };
  }

  // If this was active league, switch to another one
  if (profile.active_league_id === leagueId) {
    // Get another league to switch to
    const { data: otherLeagues } = await supabase
      .from('league_members')
      .select('league_id')
      .eq('user_id', profile.id)
      .limit(1)
      .single();

    if (otherLeagues) {
      await supabase
        .from('profiles')
        .update({ active_league_id: otherLeagues.league_id })
        .eq('id', profile.id);
    } else {
      // No other leagues, set to null
      await supabase
        .from('profiles')
        .update({ active_league_id: null })
        .eq('id', profile.id);
    }
  }

  return { success: true };
}

// Create an invite link for a league
export async function createLeagueInvite(leagueId: string) {
  const { profile, error: authError } = await getProfileForClerkUser();
  
  if (authError || !profile) {
    return { success: false, error: 'Not authenticated' };
  }

  const supabase = createServiceClient();

  // Verify user is a member of this league
  const { data: membership } = await supabase
    .from('league_members')
    .select('id')
    .eq('user_id', profile.id)
    .eq('league_id', leagueId)
    .single();

  if (!membership) {
    return { success: false, error: 'Not a member of this league' };
  }

  // Generate invite code using the database function
  const { data: codeResult, error: codeError } = await supabase
    .rpc('generate_invite_code');

  if (codeError || !codeResult) {
    return { success: false, error: 'Failed to generate invite code' };
  }

  // Create the invite
  const { data: invite, error: inviteError } = await supabase
    .from('league_invites')
    .insert({
      league_id: leagueId,
      invite_code: codeResult,
      created_by: profile.id,
    })
    .select('id, invite_code')
    .single();

  if (inviteError || !invite) {
    return { success: false, error: 'Failed to create invite' };
  }

  return { 
    success: true, 
    inviteCode: invite.invite_code,
    inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/invite/${invite.invite_code}`
  };
}

// Get league settings (money board configuration)
export async function getLeagueSettings(leagueId: string) {
  const { profile, error: authError } = await getProfileForClerkUser();
  
  if (authError || !profile) {
    return { success: false, error: 'Not authenticated' };
  }

  const supabase = createServiceClient();

  // Verify user is a member of this league
  const { data: membership } = await supabase
    .from('league_members')
    .select('id')
    .eq('user_id', profile.id)
    .eq('league_id', leagueId)
    .single();

  if (!membership) {
    return { success: false, error: 'Not a member of this league' };
  }

  // Get league settings
  const { data: league, error } = await supabase
    .from('leagues')
    .select(`
      id,
      name,
      google_sheet_url,
      google_sheet_embed_url,
      buy_in_amount,
      venmo_username,
      venmo_qr_image_path,
      payment_instructions,
      payout_description,
      created_by
    `)
    .eq('id', leagueId)
    .single();

  if (error || !league) {
    return { success: false, error: 'League not found' };
  }

  // Check if user is commissioner
  const isCommissioner = league.created_by === profile.id;

  return { 
    success: true, 
    settings: league,
    isCommissioner
  };
}

// Update league money board settings (commissioner only)
export async function updateLeagueSettings(
  leagueId: string,
  settings: {
    google_sheet_url?: string | null;
    google_sheet_embed_url?: string | null;
    buy_in_amount?: number | null;
    venmo_username?: string | null;
    venmo_qr_image_path?: string | null;
    payment_instructions?: string | null;
    payout_description?: string | null;
  }
) {
  const { profile, error: authError } = await getProfileForClerkUser();
  
  if (authError || !profile) {
    return { success: false, error: 'Not authenticated' };
  }

  const supabase = createServiceClient();

  // Verify user is commissioner (created_by)
  const { data: league } = await supabase
    .from('leagues')
    .select('id, created_by')
    .eq('id', leagueId)
    .single();

  if (!league) {
    return { success: false, error: 'League not found' };
  }

  if (league.created_by !== profile.id) {
    return { success: false, error: 'Only the commissioner can update league settings' };
  }

  // Update settings
  const { error: updateError } = await supabase
    .from('leagues')
    .update({
      google_sheet_url: settings.google_sheet_url,
      google_sheet_embed_url: settings.google_sheet_embed_url,
      buy_in_amount: settings.buy_in_amount,
      venmo_username: settings.venmo_username,
      venmo_qr_image_path: settings.venmo_qr_image_path,
      payment_instructions: settings.payment_instructions,
      payout_description: settings.payout_description,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leagueId);

  if (updateError) {
    console.error('Error updating league settings:', updateError);
    return { success: false, error: 'Failed to update settings' };
  }

  return { success: true };
}

// Accept an invite and join the league
export async function acceptLeagueInvite(inviteCode: string) {
  const { profile, error: authError } = await getProfileForClerkUser();
  
  if (authError || !profile) {
    return { success: false, error: 'Not authenticated', requiresAuth: true };
  }

  const supabase = createServiceClient();

  // Get invite details
  const { data: invite, error: inviteError } = await supabase
    .from('league_invites')
    .select(`
      id,
      league_id,
      max_uses,
      current_uses,
      is_active,
      expires_at,
      leagues:league_id (
        id,
        name
      )
    `)
    .eq('invite_code', inviteCode)
    .single();

  if (inviteError || !invite) {
    return { success: false, error: 'Invalid invite code' };
  }

  // Check if invite is valid
  if (!invite.is_active) {
    return { success: false, error: 'This invite is no longer active' };
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { success: false, error: 'This invite has expired' };
  }

  if (invite.max_uses && invite.current_uses >= invite.max_uses) {
    return { success: false, error: 'This invite has reached its maximum uses' };
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('league_members')
    .select('id')
    .eq('user_id', profile.id)
    .eq('league_id', invite.league_id)
    .single();

  if (existingMember) {
    // Already a member, just switch to this league
    await supabase
      .from('profiles')
      .update({ active_league_id: invite.league_id })
      .eq('id', profile.id);
    
    return { 
      success: true, 
      message: 'You are already a member of this league',
      leagueName: (invite.leagues as any)?.name
    };
  }

  // Add user to league_members
  const { error: memberError } = await supabase
    .from('league_members')
    .insert({ 
      user_id: profile.id, 
      league_id: invite.league_id,
      is_active: true
    });

  if (memberError) {
    return { success: false, error: 'Failed to join league' };
  }

  // Set as active league
  await supabase
    .from('profiles')
    .update({ active_league_id: invite.league_id })
    .eq('id', profile.id);

  // Increment invite usage count
  await supabase
    .from('league_invites')
    .update({ current_uses: invite.current_uses + 1 })
    .eq('id', invite.id);

  return { 
    success: true, 
    message: 'Successfully joined league!',
    leagueName: (invite.leagues as any)?.name
  };
}
