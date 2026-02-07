import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { canEditRoster } from '@/lib/league-utils';

/**
 * POST /api/rosters
 * Create a new roster. Supports co-manager creating on behalf of the team owner.
 * When `target_user_id` is provided, verifies the caller is a co-manager of that user's team.
 */
export async function POST(request: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get current user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, active_league_id, username')
    .eq('clerk_id', clerkUserId)
    .single();

  if (!profile) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
  }

  // Parse request body
  const body = await request.json();
  const { tournament_id, budget_spent, player_ids, target_user_id } = body as {
    tournament_id: string;
    budget_spent: number;
    player_ids: string[];
    target_user_id?: string;
  };

  if (!tournament_id || !player_ids || !Array.isArray(player_ids)) {
    return NextResponse.json({ success: false, error: 'tournament_id and player_ids are required' }, { status: 400 });
  }

  // Determine whose roster this is
  const rosterOwnerId = target_user_id || profile.id;

  // If creating on behalf of another user, verify co-manager authorization
  if (target_user_id && target_user_id !== profile.id) {
    const allowed = await canEditRoster(
      supabase,
      profile.active_league_id,
      target_user_id,
      profile.id
    );

    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Not authorized to create a roster for this user' }, { status: 403 });
    }
  }

  // Get the roster owner's username for the roster name
  let rosterName = profile.username || 'Team';
  if (rosterOwnerId !== profile.id) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', rosterOwnerId)
      .single();
    rosterName = ownerProfile?.username || 'Team';
  }

  // Check if the owner already has a roster for this tournament
  const { data: existingRoster } = await supabase
    .from('user_rosters')
    .select('id')
    .eq('user_id', rosterOwnerId)
    .eq('tournament_id', tournament_id)
    .maybeSingle();

  if (existingRoster) {
    return NextResponse.json({ success: false, error: 'A roster already exists for this tournament. Please edit the existing one.' }, { status: 409 });
  }

  // Create the roster
  const { data: roster, error: rosterError } = await supabase
    .from('user_rosters')
    .insert({
      user_id: rosterOwnerId,
      tournament_id: tournament_id,
      roster_name: rosterName,
      budget_spent: budget_spent,
      budget_limit: 30.00,
      max_players: 10,
    })
    .select()
    .single();

  if (rosterError) {
    if (rosterError.code === '23505') {
      return NextResponse.json({ success: false, error: 'A roster already exists for this tournament.' }, { status: 409 });
    }
    console.error('Error creating roster:', rosterError);
    return NextResponse.json({ success: false, error: 'Failed to create roster' }, { status: 500 });
  }

  // Get tournament_player IDs and costs for the selected players
  const { data: tournamentPlayers, error: tpError } = await supabase
    .from('tournament_players')
    .select('id, pga_player_id, cost')
    .eq('tournament_id', tournament_id)
    .in('pga_player_id', player_ids);

  if (tpError) {
    console.error('Error fetching tournament players:', tpError);
    return NextResponse.json({ success: false, error: 'Failed to fetch tournament players' }, { status: 500 });
  }

  // Insert roster players
  const rosterPlayers = (tournamentPlayers || []).map((tp) => ({
    roster_id: roster.id,
    tournament_player_id: tp.id,
    player_cost: tp.cost ?? 0.2,
  }));

  const { error: insertError } = await supabase
    .from('roster_players')
    .insert(rosterPlayers);

  if (insertError) {
    console.error('Error inserting roster players:', insertError);
    return NextResponse.json({ success: false, error: 'Failed to save roster players' }, { status: 500 });
  }

  return NextResponse.json({ success: true, rosterId: roster.id });
}
