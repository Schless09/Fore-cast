import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const AMATEUR_PLAYER_NAME = 'Daniel Bennett';

/**
 * POST /api/admin/notify-amateur-roster
 * One-off: email everyone who has Daniel Bennett in their current roster.
 * Amateurs can't win PGA money — they need to remove him.
 * Auth: Admin (same as other admin APIs).
 */
export async function POST(_request: NextRequest) {
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

  const debug: Record<string, unknown> = {};

  try {
    const { data: pgaPlayer, error: playerError } = await supabase
      .from('pga_players')
      .select('id, name')
      .ilike('name', `%${AMATEUR_PLAYER_NAME.split(' ').join('%')}%`)
      .limit(1)
      .single();

    debug.pgaPlayerId = pgaPlayer?.id ?? null;
    debug.pgaPlayerName = pgaPlayer?.name ?? null;
    debug.playerError = playerError?.message ?? null;

    if (playerError || !pgaPlayer) {
      return NextResponse.json(
        { success: false, error: `Player "${AMATEUR_PLAYER_NAME}" not found`, debug },
        { status: 404 }
      );
    }

    // All upcoming/active tournaments (no date filter — admin rosters page shows all; match that so we don't miss any)
    const { data: thisWeeksTournaments, error: tErr } = await supabase
      .from('tournaments')
      .select('id, name, start_date')
      .in('status', ['upcoming', 'active'])
      .order('start_date', { ascending: true });

    debug.tournamentsFound = thisWeeksTournaments?.length ?? 0;
    debug.tournamentIds = thisWeeksTournaments?.map((t) => t.id) ?? [];
    debug.tournamentsError = tErr?.message ?? null;

    if (tErr || !thisWeeksTournaments?.length) {
      return NextResponse.json({
        success: true,
        message: 'No upcoming/active tournaments found',
        emailsSent: 0,
        recipientCount: 0,
        debug,
      });
    }

    const tournamentIds = thisWeeksTournaments.map((t) => t.id);

    // All tournament_players for Daniel Bennett in any of these tournaments
    const { data: tps, error: tpError } = await supabase
      .from('tournament_players')
      .select('id, tournament_id, tournaments(name)')
      .eq('pga_player_id', pgaPlayer.id)
      .in('tournament_id', tournamentIds);

    debug.tournamentPlayersFound = tps?.length ?? 0;
    debug.tpIds = tps?.map((tp) => tp.id) ?? [];
    debug.tpError = tpError?.message ?? null;

    if (tpError || !tps?.length) {
      return NextResponse.json({
        success: true,
        message: `No tournament_players for ${AMATEUR_PLAYER_NAME} in these tournaments`,
        emailsSent: 0,
        recipientCount: 0,
        debug,
      });
    }

    const tpIds = tps.map((tp) => tp.id);
    const { data: rosterPlayerRows, error: rpError } = await supabase
      .from('roster_players')
      .select('roster_id')
      .in('tournament_player_id', tpIds);

    debug.rosterPlayersFound = rosterPlayerRows?.length ?? 0;
    debug.rosterIds = rosterPlayerRows ? [...new Set(rosterPlayerRows.map((r) => r.roster_id))] : [];
    debug.rpError = rpError?.message ?? null;

    if (rpError || !rosterPlayerRows?.length) {
      return NextResponse.json({
        success: true,
        message: 'No roster_players link to this tournament_player',
        emailsSent: 0,
        recipientCount: 0,
        debug,
      });
    }

    const rosterIds = [...new Set(rosterPlayerRows.map((r) => r.roster_id))];
    const { data: rosters, error: rosterError } = await supabase
      .from('user_rosters')
      .select('id, user_id, tournament_id, tournaments(name)')
      .in('id', rosterIds);

    if (rosterError || !rosters?.length) {
      return NextResponse.json({ success: false, error: 'Failed to load rosters' }, { status: 500 });
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, clerk_id')
      .in('id', [...new Set(rosters.map((r) => r.user_id))]);

    const userEmails = new Map<string, string>();
    for (const p of profiles ?? []) {
      const profileEmail = (p as { email?: string | null }).email;
      if (profileEmail?.trim()) {
        userEmails.set(p.id, profileEmail.trim());
        continue;
      }
      const clerkId = (p as { clerk_id?: string | null }).clerk_id;
      if (clerkId) {
        try {
          const client = await clerkClient();
          const user = await client.users.getUser(clerkId);
          const primaryEmail =
            user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
            user.emailAddresses?.[0]?.emailAddress;
          if (primaryEmail) userEmails.set(p.id, primaryEmail);
        } catch (err) {
          console.error('[notify-amateur-roster] Clerk lookup failed for', clerkId, err);
        }
      }
    }

    const tournamentNames = thisWeeksTournaments.map((t) => t.name);
    const tournamentName = tournamentNames.length === 1 ? tournamentNames[0] : tournamentNames.join(' or ');

    const subject = `${AMATEUR_PLAYER_NAME} – Please remove from your roster`;
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px;">
      <p style="color: #1f2937; margin-bottom: 12px;">
        <strong>${AMATEUR_PLAYER_NAME}</strong> is an amateur and is not eligible to win prize money on the PGA Tour.
      </p>
      <p style="color: #4b5563;">
        He's on your roster for ${tournamentName} — please remove him and pick another player before lock.
      </p>
      <p style="color: #9ca3af; font-size: 14px; margin-top: 20px;">
        — FORE!SIGHT
      </p>
    </div>
    `;

    const from = process.env.RESEND_FROM_EMAIL || 'FORE!SIGHT <noreply@resend.dev>';
    let emailsSent = 0;
    const seenEmails = new Set<string>();
    const uniqueUserIds = [...new Set(rosters.map((r) => r.user_id))];
    let firstSendError: string | null = null;
    let sendAttempts = 0;

    for (const userId of uniqueUserIds) {
      const email = userEmails.get(userId);
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      sendAttempts++;
      const { error } = await resend.emails.send({ from, to: email, subject, html: htmlContent });
      if (!error) {
        emailsSent++;
      } else if (!firstSendError) {
        firstSendError = typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message)
          : JSON.stringify(error);
      }
    }

    debug.rostersLoaded = rosters.length;
    debug.uniqueUserIds = uniqueUserIds.length;
    debug.emailsResolved = userEmails.size;
    debug.sendAttempts = sendAttempts;
    debug.firstSendError = firstSendError;

    return NextResponse.json({
      success: true,
      message: `Sent ${emailsSent} email(s) to users with ${AMATEUR_PLAYER_NAME} on their roster`,
      emailsSent,
      recipientCount: uniqueUserIds.length,
      rostersAffected: rosterIds.length,
      debug,
    });
  } catch (error) {
    console.error('[notify-amateur-roster]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to send emails' },
      { status: 500 }
    );
  }
}
