import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { canEditRoster } from '@/lib/league-utils';

/**
 * PUT /api/rosters/[rosterId]
 * Update a roster (owner or co-member). This endpoint bypasses RLS using the service client
 * after verifying the caller is authorized (roster owner or co-member of the owner's team).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ rosterId: string }> }
) {
  const { rosterId } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get current user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, active_league_id')
    .eq('clerk_id', clerkUserId)
    .single();

  if (!profile) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
  }

  // Get the roster with current players (for snapshot before overwrite)
  const { data: roster } = await supabase
    .from('user_rosters')
    .select('id, user_id, tournament_id, roster_name, budget_spent')
    .eq('id', rosterId)
    .single();

  if (!roster) {
    return NextResponse.json({ success: false, error: 'Roster not found' }, { status: 404 });
  }

  // Check authorization: owner or co-member
  const allowed = await canEditRoster(
    supabase,
    profile.active_league_id,
    roster.user_id,
    profile.id
  );

  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Not authorized to edit this roster' }, { status: 403 });
  }

  // Parse request body
  const body = await request.json();
  const { roster_name, budget_spent, player_ids } = body as {
    roster_name: string;
    budget_spent: number;
    player_ids: string[];
  };

  if (!player_ids || !Array.isArray(player_ids)) {
    return NextResponse.json({ success: false, error: 'player_ids is required' }, { status: 400 });
  }

  // Snapshot current roster to version history (for post-tournament "woulda coulda" email)
  const { data: currentPlayers } = await supabase
    .from('roster_players')
    .select('tournament_player_id')
    .eq('roster_id', rosterId);

  if (currentPlayers && currentPlayers.length > 0) {
    const { data: version, error: versionError } = await supabase
      .from('roster_versions')
      .insert({
        roster_id: rosterId,
        tournament_id: roster.tournament_id,
        user_id: roster.user_id,
        budget_spent: roster.budget_spent ?? undefined,
        roster_name: roster.roster_name ?? undefined,
      })
      .select('id')
      .single();

    if (!versionError && version) {
      await supabase.from('roster_version_players').insert(
        currentPlayers.map((p) => ({
          roster_version_id: version.id,
          tournament_player_id: p.tournament_player_id,
        }))
      );
    }
    // Non-fatal: log but don't block the edit if versioning fails
    if (versionError) {
      console.warn('Roster version snapshot failed:', versionError.message);
    }
  }

  // Update roster metadata
  const { error: rosterError } = await supabase
    .from('user_rosters')
    .update({
      roster_name: roster_name,
      budget_spent: budget_spent,
    })
    .eq('id', rosterId);

  if (rosterError) {
    console.error('Error updating roster:', rosterError);
    return NextResponse.json({ success: false, error: 'Failed to update roster' }, { status: 500 });
  }

  // Remove existing roster players
  const { error: deleteError } = await supabase
    .from('roster_players')
    .delete()
    .eq('roster_id', rosterId);

  if (deleteError) {
    console.error('Error deleting roster players:', deleteError);
    return NextResponse.json({ success: false, error: 'Failed to update roster players' }, { status: 500 });
  }

  // Get tournament_player IDs and costs for the selected players
  const { data: tournamentPlayers, error: tpError } = await supabase
    .from('tournament_players')
    .select('id, pga_player_id, cost')
    .eq('tournament_id', roster.tournament_id)
    .in('pga_player_id', player_ids);

  if (tpError) {
    console.error('Error fetching tournament players:', tpError);
    return NextResponse.json({ success: false, error: 'Failed to fetch tournament players' }, { status: 500 });
  }

  // Insert new roster players
  const rosterPlayers = (tournamentPlayers || []).map((tp) => ({
    roster_id: rosterId,
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

  return NextResponse.json({ success: true });
}
