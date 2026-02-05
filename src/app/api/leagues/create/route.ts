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

    // Validate league name
    if (leagueName.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'League name must be at least 3 characters' },
        { status: 400 }
      );
    }

    if (password.trim().length < 4) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 4 characters' },
        { status: 400 }
      );
    }

    const { profile, error: authError } = await getProfileForClerkUser();
    
    if (authError || !profile) {
      console.error('Auth error in create league API:', authError);
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Check if league name already exists
    const { data: existingLeague } = await supabase
      .from('leagues')
      .select('id')
      .eq('name', leagueName.trim())
      .single();

    if (existingLeague) {
      return NextResponse.json(
        { success: false, error: 'League name already taken' },
        { status: 409 }
      );
    }

    // Create the league
    const { data: newLeague, error: createError } = await supabase
      .from('leagues')
      .insert({ 
        name: leagueName.trim(), 
        password: password.trim(),
        created_by: profile.id 
      })
      .select('id, name')
      .single();

    if (createError || !newLeague) {
      console.error('Error creating league:', createError);
      return NextResponse.json(
        { success: false, error: 'Failed to create league' },
        { status: 500 }
      );
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
      console.error('Error adding creator to league_members:', memberError);
      return NextResponse.json(
        { success: false, error: 'Failed to join created league' },
        { status: 500 }
      );
    }

    // Set this as their active league
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ active_league_id: newLeague.id })
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
      leagueName: newLeague.name,
      leagueId: newLeague.id
    });

  } catch (error) {
    console.error('Unexpected error in create league API:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
