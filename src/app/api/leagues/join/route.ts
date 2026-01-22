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

    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error in join league API:', userError);
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Find the league by name
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name, password')
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
      .eq('user_id', user.id)
      .eq('league_id', league.id)
      .single();

    if (existingMember) {
      // Already a member, just set as active
      await supabase
        .from('profiles')
        .update({ active_league_id: league.id })
        .eq('id', user.id);
      
      return NextResponse.json({ 
        success: true, 
        leagueName: league.name,
        message: 'Already a member - set as active league'
      });
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
