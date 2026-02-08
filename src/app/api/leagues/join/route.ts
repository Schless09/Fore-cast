import { NextRequest, NextResponse } from 'next/server';
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
  const { data: existingProfile } = await supabase
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

export async function POST(request: NextRequest) {
  try {
    const { leagueName, password } = await request.json();

    if (!leagueName || !password) {
      return NextResponse.json(
        { success: false, error: 'League name and password are required' },
        { status: 400 }
      );
    }

    const { profile, error: authError } = await getProfileForClerkUser();
    
    if (authError || !profile) {
      console.error('Auth error in join league API:', authError);
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Find the league by name
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name, password, max_members')
      .eq('name', leagueName)
      .single();

    if (leagueError || !league) {
      return NextResponse.json(
        { success: false, error: 'League not found' },
        { status: 404 }
      );
    }

    // Verify password
    if (league.password !== password) {
      return NextResponse.json(
        { success: false, error: 'Incorrect password' },
        { status: 401 }
      );
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
      
      return NextResponse.json({ 
        success: true, 
        leagueName: league.name,
        message: 'Already a member - set as active league'
      });
    }

    // Check member cap if set
    if (league.max_members) {
      const { count } = await supabase
        .from('league_members')
        .select('id', { count: 'exact', head: true })
        .eq('league_id', league.id);

      if (count !== null && count >= league.max_members) {
        return NextResponse.json(
          { success: false, error: `This league is full (${league.max_members} member limit)` },
          { status: 400 }
        );
      }
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
      console.error('Error adding to league_members:', memberError);
      return NextResponse.json(
        { success: false, error: 'Failed to join league' },
        { status: 500 }
      );
    }

    // Set as active league
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ active_league_id: league.id })
      .eq('id', profile.id);

    if (updateError) {
      console.error('Error setting active league:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to set active league' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      leagueName: league.name 
    });

  } catch (error) {
    console.error('Unexpected error in join league API:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
