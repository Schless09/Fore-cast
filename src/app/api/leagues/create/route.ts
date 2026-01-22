import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error in create league API:', userError);
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

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
        created_by: user.id 
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
        user_id: user.id, 
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
      .eq('id', user.id);

    if (updateError) {
      console.error('Error setting active league:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to set active league' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      leagueName: newLeague.name 
    });

  } catch (error) {
    console.error('Unexpected error in create league API:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
