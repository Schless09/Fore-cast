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
  
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_id', userId)
    .single();

  if (existingProfile) {
    return { profile: existingProfile, error: null };
  }

  return { profile: null, error: 'Profile not found' };
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Fetch league members
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: leagueId } = await params;
    
    const { profile, error: authError } = await getProfileForClerkUser();
    
    if (authError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Get league info to check if user is commissioner
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name, created_by')
      .eq('id', leagueId)
      .single();

    if (leagueError || !league) {
      return NextResponse.json(
        { success: false, error: 'League not found' },
        { status: 404 }
      );
    }

    const isCommissioner = league.created_by === profile.id;

    // Get all league members with their profile info
    const { data: members, error: membersError } = await supabase
      .from('league_members')
      .select(`
        user_id,
        joined_at,
        profiles(id, username, email)
      `)
      .eq('league_id', leagueId)
      .order('joined_at', { ascending: true });

    if (membersError) {
      console.error('Error fetching league members:', membersError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch league members' },
        { status: 500 }
      );
    }

    // Format member data
    const formattedMembers = (members || []).map(m => {
      const memberProfile = m.profiles as unknown as { id: string; username: string; email: string } | null;
      return {
        user_id: m.user_id,
        username: memberProfile?.username || 'Unknown',
        email: memberProfile?.email || '',
        joined_at: m.joined_at,
        is_commissioner: m.user_id === league.created_by,
        role: m.user_id === league.created_by ? 'commissioner' as const : 'member' as const,
      };
    });

    // Get co-managers for this league
    const { data: coMembers } = await supabase
      .from('team_co_members')
      .select(`
        co_member_id,
        created_at,
        owner_id,
        co_profile:profiles!team_co_members_co_member_id_fkey(id, username, email),
        owner_profile:profiles!team_co_members_owner_id_fkey(id, username)
      `)
      .eq('league_id', leagueId);

    const formattedCoManagers = (coMembers || []).map(cm => {
      const coProfile = cm.co_profile as unknown as { id: string; username: string; email: string } | null;
      const ownerProfile = cm.owner_profile as unknown as { id: string; username: string } | null;
      return {
        user_id: cm.co_member_id,
        username: coProfile?.username || 'Unknown',
        email: coProfile?.email || '',
        joined_at: cm.created_at,
        is_commissioner: false,
        role: 'co-manager' as const,
        manages_team_of: ownerProfile?.username || 'Unknown',
      };
    });

    return NextResponse.json({
      success: true,
      members: [...formattedMembers, ...formattedCoManagers],
      isCommissioner,
      commissionerId: league.created_by,
    });

  } catch (error) {
    console.error('Unexpected error in GET league members:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a member from the league (commissioner only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: leagueId } = await params;
    const { userId: memberToRemove, role } = await request.json();

    if (!memberToRemove) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const { profile, error: authError } = await getProfileForClerkUser();
    
    if (authError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Get league info to verify commissioner
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, created_by')
      .eq('id', leagueId)
      .single();

    if (leagueError || !league) {
      return NextResponse.json(
        { success: false, error: 'League not found' },
        { status: 404 }
      );
    }

    // Only commissioner can remove members
    if (league.created_by !== profile.id) {
      return NextResponse.json(
        { success: false, error: 'Only the commissioner can remove members' },
        { status: 403 }
      );
    }

    // Cannot remove the commissioner themselves
    if (memberToRemove === league.created_by) {
      return NextResponse.json(
        { success: false, error: 'Cannot remove the commissioner from the league' },
        { status: 400 }
      );
    }

    if (role === 'co-manager') {
      // Remove co-manager from team_co_members
      const { error: deleteError } = await supabase
        .from('team_co_members')
        .delete()
        .eq('league_id', leagueId)
        .eq('co_member_id', memberToRemove);

      if (deleteError) {
        console.error('Error removing co-manager:', deleteError);
        return NextResponse.json(
          { success: false, error: 'Failed to remove co-manager' },
          { status: 500 }
        );
      }
    } else {
      // Remove the league member
      const { error: deleteError } = await supabase
        .from('league_members')
        .delete()
        .eq('league_id', leagueId)
        .eq('user_id', memberToRemove);

      if (deleteError) {
        console.error('Error removing league member:', deleteError);
        return NextResponse.json(
          { success: false, error: 'Failed to remove member' },
          { status: 500 }
        );
      }
    }

    // If this was their active league, clear it
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ active_league_id: null })
      .eq('id', memberToRemove)
      .eq('active_league_id', leagueId);

    if (updateError) {
      console.error('Error clearing active league:', updateError);
      // Don't fail the request, just log it
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Unexpected error in DELETE league member:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
