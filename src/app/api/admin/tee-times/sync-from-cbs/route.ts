import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  syncTeeTimesAndWithdrawalsFromCBS,
  isInPreTournamentWindow,
} from '@/lib/cbs-tee-times';

/**
 * POST /api/admin/tee-times/sync-from-cbs
 * Manually trigger CBS sync for upcoming tournaments in pre-tournament window.
 * Auth: Admin (same as other admin APIs).
 */
export async function POST(request: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', clerkUserId)
    .single();

  if (!profile) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 401 });
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const sevenDaysStr = sevenDaysFromNow.toISOString().slice(0, 10);

  const { data: tournaments, error: tError } = await supabase
    .from('tournaments')
    .select('id, name, start_date')
    .eq('status', 'upcoming')
    .gte('start_date', todayStr)
    .lte('start_date', sevenDaysStr);

  if (tError || !tournaments?.length) {
    return NextResponse.json({
      success: true,
      message: 'No upcoming tournaments to sync',
      tournamentsChecked: 0,
      details: [],
    });
  }

  const inWindow = tournaments.filter((t) => isInPreTournamentWindow(t, now));

  // Diagnostic: check player counts for Cognizant (or any) to find ID mismatch
  const { data: allCognizant } = await supabase
    .from('tournaments')
    .select('id, name, start_date, status')
    .ilike('name', '%cognizant%');
  const cognizantLike = allCognizant ?? [];
  const playerCounts: { id: string; name: string; start_date: string; count: number }[] = [];
  for (const t of cognizantLike) {
    const { count } = await supabase
      .from('tournament_players')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', t.id);
    playerCounts.push({ id: t.id, name: t.name, start_date: t.start_date, count: count ?? 0 });
  }

  if (inWindow.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No tournaments in pre-tournament window (Tue–Thu, starts within 2 days)',
      tournamentsChecked: tournaments.length,
      inWindow: 0,
      details: tournaments.map((t) => ({ name: t.name, inWindow: false })),
    });
  }

  const results: {
    tournament: string;
    teeTimesMatched: number;
    replacementsAdded: number;
    withdrawnCount: number;
    emailsSent: number;
    withdrawnPlayerNames?: string[];
    skipped?: string;
    message: string;
    debug?: { cbsRows: number; matched: number; totalDb: number; matchRatePct: number };
  }[] = [];

  for (const tournament of inWindow) {
    const result = await syncTeeTimesAndWithdrawalsFromCBS(supabase, tournament);
    results.push({
      tournament: tournament.name,
      teeTimesMatched: result.teeTimesMatched,
      replacementsAdded: result.replacementsAdded,
      withdrawnCount: result.withdrawnCount,
      emailsSent: result.emailsSent,
      withdrawnPlayerNames: result.withdrawnPlayerNames,
      skipped: result.skipped,
      message: result.message,
      debug: result.debug,
    });
  }

  const totalTeeTimes = results.reduce((s, r) => s + r.teeTimesMatched, 0);
  const totalReplacements = results.reduce((s, r) => s + r.replacementsAdded, 0);
  const totalWithdrawn = results.reduce((s, r) => s + r.withdrawnCount, 0);
  const firstSkipped = results.find((r) => r.skipped);

  const hasPlayers = playerCounts.some((p) => p.count > 0);
  const windowZero = inWindow.some(
    (w) => playerCounts.find((p) => p.id === w.id)?.count === 0
  );

  return NextResponse.json({
    success: true,
    message:
      totalTeeTimes + totalReplacements + totalWithdrawn > 0
        ? `CBS sync: ${totalTeeTimes} tee times, ${totalReplacements} replacements, ${totalWithdrawn} WD`
        : firstSkipped
          ? `Skipped: ${firstSkipped.skipped}. ${firstSkipped.message}`
          : `CBS sync: ${totalTeeTimes} tee times, ${totalReplacements} replacements, ${totalWithdrawn} WD`,
    tournamentsChecked: inWindow.length,
    teeTimesMatched: totalTeeTimes,
    replacementsAdded: totalReplacements,
    withdrawnCount: totalWithdrawn,
    details: results,
    diagnostic:
      playerCounts.length > 0
        ? {
            cognizantTournaments: playerCounts,
            inWindowIds: inWindow.map((t) => t.id),
            hint: hasPlayers && windowZero
              ? 'The tournament in the sync window has 0 players; another Cognizant record has players. Fix: run odds import for the correct tournament, or merge duplicates.'
              : undefined,
          }
        : undefined,
  });
}
