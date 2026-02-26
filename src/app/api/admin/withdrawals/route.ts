import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { markPlayersWithdrawnAndNotify } from '@/lib/withdrawals';

/**
 * POST /api/admin/withdrawals
 * Mark player(s) as withdrawn for a tournament and email roster owners who have them.
 *
 * Body: { tournamentId: string, pgaPlayerIds: string[] }
 * Auth: Authenticated admin
 */
export async function POST(request: NextRequest) {
  const { userId: clerkUserId } = await auth();
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isDev = process.env.NODE_ENV === 'development';

  if (!clerkUserId && !isCron) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let tournamentId: string;
  let pgaPlayerIds: string[];
  try {
    const body = await request.json();
    tournamentId = body.tournamentId ?? '';
    pgaPlayerIds = Array.isArray(body.pgaPlayerIds) ? body.pgaPlayerIds : [];
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid body. Expected { tournamentId, pgaPlayerIds }' },
      { status: 400 }
    );
  }

  if (!tournamentId || pgaPlayerIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'tournamentId and pgaPlayerIds (non-empty) are required' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  if (!isCron && !isDev) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_id', clerkUserId)
      .single();
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const result = await markPlayersWithdrawnAndNotify(supabase, tournamentId, pgaPlayerIds);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error ?? 'Failed to mark withdrawals' },
      { status: result.error === 'Tournament not found' ? 404 : 500 }
    );
  }

  if (result.withdrawnCount === 0) {
    return NextResponse.json({
      success: true,
      message: 'No players to update (already withdrawn or not found)',
      withdrawnCount: 0,
      emailsSent: 0,
    });
  }

  const message =
    result.emailsUnavailable && result.emailsSent === 0
      ? `Marked ${result.withdrawnCount} player(s) as withdrawn. No emails sent — no email address found for affected roster owners (check profiles or Clerk).`
      : `Marked ${result.withdrawnCount} player(s) as withdrawn. Sent ${result.emailsSent} email(s) to roster owners.`;

  return NextResponse.json({
    success: true,
    message,
    withdrawnCount: result.withdrawnCount,
    emailsSent: result.emailsSent,
    emailsUnavailable: result.emailsUnavailable,
  });
}

/**
 * PATCH /api/admin/withdrawals
 * Unmark player(s) as withdrawn (set withdrawn = false).
 *
 * Body: { tournamentId: string, pgaPlayerIds: string[] }
 */
export async function PATCH(request: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let tournamentId: string;
  let pgaPlayerIds: string[];
  try {
    const body = await request.json();
    tournamentId = body.tournamentId ?? '';
    pgaPlayerIds = Array.isArray(body.pgaPlayerIds) ? body.pgaPlayerIds : [];
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid body. Expected { tournamentId, pgaPlayerIds }' },
      { status: 400 }
    );
  }

  if (!tournamentId || pgaPlayerIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'tournamentId and pgaPlayerIds (non-empty) are required' },
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

  const { data: tps, error: tpError } = await supabase
    .from('tournament_players')
    .select('id')
    .eq('tournament_id', tournamentId)
    .in('pga_player_id', pgaPlayerIds)
    .eq('withdrawn', true);

  if (tpError || !tps?.length) {
    return NextResponse.json({
      success: true,
      message: 'No withdrawn players to unmark',
      unmarkedCount: 0,
    });
  }

  const tpIds = tps.map((tp) => tp.id);
  const { error: updateError } = await supabase
    .from('tournament_players')
    .update({ withdrawn: false })
    .in('id', tpIds);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: `Failed to unmark: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Unmarked ${tps.length} player(s) from WD`,
    unmarkedCount: tps.length,
  });
}
