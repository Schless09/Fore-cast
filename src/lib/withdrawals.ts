import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { clerkClient } from '@clerk/nextjs/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface MarkWithdrawnResult {
  success: boolean;
  withdrawnCount: number;
  emailsSent: number;
  /** Set when no emails could be sent (e.g. no email on profile or Clerk) */
  emailsUnavailable?: boolean;
  error?: string;
}

/**
 * Mark players as withdrawn and email affected roster owners.
 * Used by admin API and cron check-withdrawals.
 */
export async function markPlayersWithdrawnAndNotify(
  supabase: SupabaseClient,
  tournamentId: string,
  pgaPlayerIds: string[]
): Promise<MarkWithdrawnResult> {
  if (pgaPlayerIds.length === 0) {
    return { success: true, withdrawnCount: 0, emailsSent: 0 };
  }

  const { data: tournament, error: tError } = await supabase
    .from('tournaments')
    .select('name')
    .eq('id', tournamentId)
    .single();

  if (tError || !tournament) {
    return { success: false, withdrawnCount: 0, emailsSent: 0, error: 'Tournament not found' };
  }

  const { data: tps, error: tpError } = await supabase
    .from('tournament_players')
    .select('id, pga_player_id, pga_players(name)')
    .eq('tournament_id', tournamentId)
    .in('pga_player_id', pgaPlayerIds)
    .eq('withdrawn', false);

  if (tpError || !tps?.length) {
    return { success: true, withdrawnCount: 0, emailsSent: 0 };
  }

  const tpIds = tps.map((tp) => tp.id);
  const { error: updateError } = await supabase
    .from('tournament_players')
    .update({ withdrawn: true })
    .in('id', tpIds);

  if (updateError) {
    return {
      success: false,
      withdrawnCount: 0,
      emailsSent: 0,
      error: `Failed to update: ${updateError.message}`,
    };
  }

  const { data: rosterPlayerRows, error: rpError } = await supabase
    .from('roster_players')
    .select('roster_id')
    .in('tournament_player_id', tpIds);

  if (rpError) {
    console.error('[Withdrawals] Error fetching roster_players:', rpError);
    return {
      success: true,
      withdrawnCount: tps.length,
      emailsSent: 0,
    };
  }

  const rosterIds = [...new Set((rosterPlayerRows ?? []).map((r) => r.roster_id))];
  if (rosterIds.length === 0) {
    return { success: true, withdrawnCount: tps.length, emailsSent: 0 };
  }

  const { data: rosters, error: rosterError } = await supabase
    .from('user_rosters')
    .select('user_id')
    .in('id', rosterIds);

  if (rosterError || !rosters?.length) {
    return { success: true, withdrawnCount: tps.length, emailsSent: 0 };
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, clerk_id')
    .in('id', rosters.map((r) => r.user_id));

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
        const primaryEmail = user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress
          ?? user.emailAddresses?.[0]?.emailAddress;
        if (primaryEmail) userEmails.set(p.id, primaryEmail);
      } catch (err) {
        console.error('[Withdrawals] Clerk lookup failed for clerk_id', clerkId, err);
      }
    }
  }

  const playerNames = tps
    .map((tp) => {
      const pga = tp.pga_players as { name?: string } | { name?: string }[] | null;
      return Array.isArray(pga) ? pga[0]?.name : pga?.name;
    })
    .filter(Boolean)
    .join(', ') || 'Unknown';
  const verb = tps.length === 1 ? 'has' : 'have';
  const subject = `${playerNames} ${verb} Withdrawn from ${tournament.name}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937; margin-bottom: 16px;">Withdrawal Notice</h2>
      <p style="color: #4b5563; margin-bottom: 16px;">
        <strong>${playerNames}</strong> ${verb} withdrawn from <strong>${tournament.name}</strong>.
      </p>
      <p style="color: #4b5563;">
        Please modify your roster to replace this player before the tournament starts.
      </p>
      <p style="color: #9ca3af; font-size: 14px; margin-top: 24px;">
        — FORE!cast Golf
      </p>
    </div>
  `;

  let emailsSent = 0;
  const seenEmails = new Set<string>();
  const uniqueUserIds = [...new Set(rosters.map((r) => r.user_id))];
  const recipientsWithoutEmail = uniqueUserIds.filter((uid) => !userEmails.has(uid));

  for (const roster of rosters) {
    const email = userEmails.get(roster.user_id);
    if (!email || seenEmails.has(email)) continue;
    seenEmails.add(email);
    try {
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'FORE!cast <noreply@resend.dev>',
        to: email,
        subject,
        html: htmlContent,
      });
      if (!error) emailsSent++;
    } catch (err) {
      console.error('[Withdrawals] Email send error:', err);
    }
  }

  return {
    success: true,
    withdrawnCount: tps.length,
    emailsSent,
    emailsUnavailable: rosterIds.length > 0 && recipientsWithoutEmail.length > 0 && emailsSent === 0,
  };
}
