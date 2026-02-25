import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  syncTeeTimesAndWithdrawalsFromCBS,
  isInPreTournamentWindow,
} from '@/lib/cbs-tee-times';

/**
 * GET/POST /api/cron/check-withdrawals
 *
 * Runs Tue–Thu 3x daily (6am, 12pm, 6pm UTC).
 *
 * CBS-only logic: Compare our DB tournament_players to CBS leaderboard tee times.
 * - On CBS with tee time → sync R1/R2 tee times to DB (EST)
 * - In DB but not on CBS → mark withdrawn, email roster owners
 *
 * Window: Tuesday afternoon through Thursday morning until tournament starts.
 */

export async function GET(request: NextRequest) {
  return runCheck(request);
}

export async function POST(request: NextRequest) {
  return runCheck(request);
}

async function runCheck(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();

  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const sevenDaysStr = sevenDaysFromNow.toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  const { data: tournaments, error: tError } = await supabase
    .from('tournaments')
    .select('id, name, start_date')
    .eq('status', 'upcoming')
    .gte('start_date', todayStr)
    .lte('start_date', sevenDaysStr);

  if (tError || !tournaments?.length) {
    return NextResponse.json({
      success: true,
      message: 'No upcoming tournaments to check',
      tournamentsChecked: 0,
      teeTimesMatched: 0,
      replacementsAdded: 0,
      withdrawnCount: 0,
      emailsSent: 0,
    });
  }

  const inWindow = tournaments.filter((t) => isInPreTournamentWindow(t, now));
  if (inWindow.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No tournaments in pre-tournament window (Tue afternoon – Thu morning)',
      tournamentsChecked: tournaments.length,
      inWindow: 0,
      teeTimesMatched: 0,
      replacementsAdded: 0,
      withdrawnCount: 0,
      emailsSent: 0,
    });
  }

  let totalTeeTimes = 0;
  let totalReplacements = 0;
  let totalWithdrawn = 0;
  let totalEmails = 0;
  const results: {
    tournament: string;
    teeTimesMatched: number;
    replacementsAdded: number;
    withdrawn: number;
    emails: number;
    skipped?: string;
  }[] = [];

  for (const tournament of inWindow) {
    const result = await syncTeeTimesAndWithdrawalsFromCBS(supabase, tournament);

    totalTeeTimes += result.teeTimesMatched;
    totalReplacements += result.replacementsAdded;
    totalWithdrawn += result.withdrawnCount;
    totalEmails += result.emailsSent;

    results.push({
      tournament: tournament.name,
      teeTimesMatched: result.teeTimesMatched,
      replacementsAdded: result.replacementsAdded,
      withdrawn: result.withdrawnCount,
      emails: result.emailsSent,
      skipped: result.skipped,
    });

    if (result.teeTimesMatched > 0 || result.replacementsAdded > 0 || result.withdrawnCount > 0) {
      console.log(
        `[Check-WD] ${tournament.name}: ${result.teeTimesMatched} tee times, ${result.replacementsAdded} replacements, ${result.withdrawnCount} WD, ${result.emailsSent} emails`
      );
    }
  }

  return NextResponse.json({
    success: true,
    message: `CBS sync: ${totalTeeTimes} tee times, ${totalReplacements} replacements, ${totalWithdrawn} WD, ${totalEmails} emails`,
    tournamentsChecked: inWindow.length,
    teeTimesMatched: totalTeeTimes,
    replacementsAdded: totalReplacements,
    withdrawnCount: totalWithdrawn,
    emailsSent: totalEmails,
    details: results,
  });
}
