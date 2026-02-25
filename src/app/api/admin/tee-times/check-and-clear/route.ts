import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * GET /api/admin/tee-times/check-and-clear
 * Returns upcoming tournament(s) with tee time counts.
 *
 * DELETE /api/admin/tee-times/check-and-clear
 * Clears tee_time_r1/r2/r3/r4 for the upcoming tournament.
 * Body: { tournamentId: string }
 */

export async function GET() {
  const supabase = createServiceClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const sevenDaysStr = sevenDaysFromNow.toISOString().slice(0, 10);

  const { data: tournaments, error: tError } = await supabase
    .from('tournaments')
    .select('id, name, start_date')
    .eq('status', 'upcoming')
    .gte('start_date', todayStr)
    .lte('start_date', sevenDaysStr)
    .order('start_date', { ascending: true });

  if (tError || !tournaments?.length) {
    return NextResponse.json({
      upcomingTournaments: [],
      message: 'No upcoming tournaments in the next 7 days',
    });
  }

  const results: { id: string; name: string; start_date: string; withTeeTimes: number; total: number }[] = [];

  for (const t of tournaments) {
    const { data: players, error: pError } = await supabase
      .from('tournament_players')
      .select('id, tee_time_r1, tee_time_r2')
      .eq('tournament_id', t.id);

    if (pError) {
      results.push({ ...t, withTeeTimes: 0, total: 0 });
      continue;
    }

    const total = players?.length ?? 0;
    const withTeeTimes =
      players?.filter(
        (p) =>
          (p.tee_time_r1 && p.tee_time_r1 !== '-') ||
          (p.tee_time_r2 && p.tee_time_r2 !== '-')
      ).length ?? 0;

    results.push({
      id: t.id,
      name: t.name,
      start_date: t.start_date,
      withTeeTimes,
      total,
    });
  }

  return NextResponse.json({
    upcomingTournaments: results,
    message: results.length > 0 ? `${results.length} upcoming tournament(s)` : 'No upcoming tournaments',
  });
}

export async function DELETE(request: NextRequest) {
  let tournamentId: string;
  try {
    const body = await request.json().catch(() => ({}));
    tournamentId = body.tournamentId ?? '';
  } catch {
    return NextResponse.json(
      { error: 'Invalid body. Expected { tournamentId: string }' },
      { status: 400 }
    );
  }

  if (!tournamentId) {
    return NextResponse.json(
      { error: 'tournamentId is required' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('tournament_players')
    .update({
      tee_time_r1: null,
      tee_time_r2: null,
      tee_time_r3: null,
      tee_time_r4: null,
    })
    .eq('tournament_id', tournamentId)
    .select('id');

  if (error) {
    return NextResponse.json(
      { error: error.message, cleared: 0 },
      { status: 500 }
    );
  }

  const cleared = data?.length ?? 0;
  return NextResponse.json({
    success: true,
    message: `Cleared tee times for ${cleared} players in tournament`,
    cleared,
  });
}
