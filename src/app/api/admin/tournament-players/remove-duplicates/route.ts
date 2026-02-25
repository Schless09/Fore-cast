import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { playerNamesMatch } from '@/lib/cbs-tee-times';

/**
 * POST /api/admin/tournament-players/remove-duplicates
 * Remove CBS duplicate tournament_players (cost=2.50) that match existing players by name.
 * Migrates roster picks to the canonical entry before deletion.
 *
 * Body: { tournamentId: string }
 */
export async function POST(request: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let tournamentId: string;
  try {
    const body = await request.json();
    tournamentId = body.tournamentId ?? '';
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid body. Expected { tournamentId }' },
      { status: 400 }
    );
  }

  if (!tournamentId) {
    return NextResponse.json(
      { success: false, error: 'tournamentId is required' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', clerkUserId)
    .single();
  if (!profile) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data: allTps, error: tpError } = await supabase
    .from('tournament_players')
    .select('id, pga_player_id, cost')
    .eq('tournament_id', tournamentId);

  if (tpError || !allTps?.length) {
    return NextResponse.json({
      success: true,
      removed: 0,
      message: 'No tournament players found',
      duplicates: [],
    });
  }

  const pgaIds = [...new Set(allTps.map((tp) => tp.pga_player_id).filter(Boolean))];
  const { data: pgaRows } = await supabase
    .from('pga_players')
    .select('id, name')
    .in('id', pgaIds);
  const nameByPgaId = new Map<string, string>();
  for (const p of pgaRows ?? []) {
    if (p.name) nameByPgaId.set(p.id, p.name);
  }

  const CBS_DEFAULT_COST = 2.5;
  const duplicates = allTps.filter((tp) => Math.abs((tp.cost ?? 0) - CBS_DEFAULT_COST) < 0.01);
  const canonical = allTps.filter((tp) => Math.abs((tp.cost ?? 0) - CBS_DEFAULT_COST) >= 0.01);

  const toRemove: { id: string; name: string; canonicalId: string; canonicalName: string }[] = [];
  for (const dup of duplicates) {
    const dupName = dup.pga_player_id ? nameByPgaId.get(dup.pga_player_id) : null;
    if (!dupName) continue;
    for (const can of canonical) {
      if (can.id === dup.id) continue;
      const canName = can.pga_player_id ? nameByPgaId.get(can.pga_player_id) : null;
      if (!canName) continue;
      if (playerNamesMatch(dupName, canName)) {
        toRemove.push({
          id: dup.id,
          name: dupName,
          canonicalId: can.id,
          canonicalName: canName,
        });
        break;
      }
    }
  }

  let removed = 0;
  for (const { id: dupId, canonicalId } of toRemove) {
    const { data: rosterRefs } = await supabase
      .from('roster_players')
      .select('id, roster_id')
      .eq('tournament_player_id', dupId);

    for (const rp of rosterRefs ?? []) {
      const { data: existing } = await supabase
        .from('roster_players')
        .select('id')
        .eq('roster_id', rp.roster_id)
        .eq('tournament_player_id', canonicalId)
        .single();
      if (existing) {
        await supabase.from('roster_players').delete().eq('id', rp.id);
      } else {
        await supabase.from('roster_players').update({ tournament_player_id: canonicalId }).eq('id', rp.id);
      }
    }

    const { data: versionRefs } = await supabase
      .from('roster_version_players')
      .select('roster_version_id, tournament_player_id')
      .eq('tournament_player_id', dupId);

    for (const rvp of versionRefs ?? []) {
      const { data: versionHasCanonical } = await supabase
        .from('roster_version_players')
        .select('roster_version_id')
        .eq('roster_version_id', rvp.roster_version_id)
        .eq('tournament_player_id', canonicalId)
        .single();
      await supabase
        .from('roster_version_players')
        .delete()
        .eq('roster_version_id', rvp.roster_version_id)
        .eq('tournament_player_id', dupId);
      if (!versionHasCanonical) {
        await supabase.from('roster_version_players').insert({
          roster_version_id: rvp.roster_version_id,
          tournament_player_id: canonicalId,
        });
      }
    }

    const { error: delErr } = await supabase.from('tournament_players').delete().eq('id', dupId);
    if (!delErr) removed++;
  }

  return NextResponse.json({
    success: true,
    removed,
    message: removed > 0 ? `Removed ${removed} duplicate tournament player(s)` : 'No duplicates to remove',
    duplicates: toRemove.map((d) => ({ name: d.name, canonicalName: d.canonicalName })),
  });
}
