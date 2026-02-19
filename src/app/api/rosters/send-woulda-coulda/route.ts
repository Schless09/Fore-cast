import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getWouldaCouldaRecipients, type WouldaCouldaPlayerWinnings } from '@/lib/woulda-coulda';
import { Resend } from 'resend';
import { formatCurrency } from '@/lib/prize-money';

const resend = new Resend(process.env.RESEND_API_KEY);

function renderWouldBeRosterTable(playerWinnings: WouldaCouldaPlayerWinnings[]): string {
  const rows = playerWinnings
    .map(
      (p) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 12px; text-align: left;">${p.name}</td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 600;">${formatCurrency(p.winnings)}</td>
        </tr>
      `
    )
    .join('');
  const total = playerWinnings.reduce((sum, p) => sum + p.winnings, 0);
  return `
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px 12px; text-align: left; font-weight: 600;">Golfer</th>
          <th style="padding: 10px 12px; text-align: right; font-weight: 600;">Winnings</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="background: #fef3c7; border-top: 2px solid #f59e0b;">
          <td style="padding: 10px 12px; text-align: left; font-weight: 700;">Total</td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 700;">${formatCurrency(total)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

/**
 * POST /api/rosters/send-woulda-coulda
 * After a tournament is complete and winnings are calculated: find users who edited their roster,
 * would have finished in the money (top 4) with a previous lineup, but their current lineup scored worse.
 * Sends them a lighthearted "woulda coulda" email.
 *
 * Body: { tournamentId: string }
 * Auth: CRON_SECRET (Bearer) or dev (no secret).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const { userId: clerkUserId } = await auth();
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === 'development';
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isAuthorized = isCron || isDev || !!clerkUserId;
  if (!isAuthorized) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let tournamentId: string;
  let testEmail: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    const b = body as { tournamentId?: string; testEmail?: string };
    tournamentId = b.tournamentId ?? '';
    testEmail = b.testEmail;
  } catch {
    tournamentId = '';
    testEmail = undefined;
  }

  if (testEmail) {
    const testPlayerWinnings: WouldaCouldaPlayerWinnings[] = [
      { name: 'Scottie Scheffler', winnings: 18500 },
      { name: 'Rory McIlroy', winnings: 12500 },
      { name: 'Tommy Fleetwood', winnings: 8200 },
      { name: 'Lucas Glover', winnings: 9000 },
    ];
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #f59e0b; margin-bottom: 10px;">🤔 Woulda, coulda, shoulda...</h1>
        <p style="color: #6b7280; margin-bottom: 20px;">We ran the numbers. You're not gonna love this.</p>
        
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0 0 8px 0;"><strong>The American Express</strong></p>
          <p style="margin: 0 0 8px 0;">Your <em>current</em> lineup finished in <strong>6th</strong> place with $12,450.00.</p>
          <p style="margin: 0 0 12px 0;">But a lineup you <em>had before you changed it</em> would have finished <strong>2nd</strong> with $48,200.00 — in the money. 💸</p>
          <p style="margin: 0; font-size: 13px; color: #92400e;">That roster would have earned:</p>
        </div>
        ${renderWouldBeRosterTable(testPlayerWinnings)}

        <p style="color: #6b7280; font-size: 14px;">
          Suuuuuuucks! But maybe next time... trust your instincts?
        </p>
        <p style="margin-top: 24px; color: #6b7280; text-align: center;">
          — FORE!SIGHT
        </p>
        <p style="margin-top: 8px; color: #fbbf24; font-weight: bold; text-align: center; font-size: 18px;">FORE!SIGHT</p>
      </div>
    `;
    const { error } = await resend.emails.send({
      from: 'FORE!SIGHT <andy@foresightgolfleague.com>',
      replyTo: 'arschuessler90@gmail.com',
      to: testEmail,
      bcc: ['arschuessler90@gmail.com'],
      subject: '🤔 Your previous lineup would have finished 2nd — The American Express (test)',
      html: htmlContent,
    });
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, testEmail, message: 'Test email sent' });
  }

  if (!tournamentId) {
    return NextResponse.json(
      { success: false, error: 'tournamentId is required (or use testEmail for a test send)' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const recipients = await getWouldaCouldaRecipients(supabase, tournamentId);
  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const r of recipients) {
    const rankOrdinal =
      r.wouldBeRank === 1
        ? '1st'
        : r.wouldBeRank === 2
          ? '2nd'
          : r.wouldBeRank === 3
            ? '3rd'
            : `${r.wouldBeRank}th`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #f59e0b; margin-bottom: 10px;">🤔 Woulda, coulda, shoulda...</h1>
        <p style="color: #6b7280; margin-bottom: 20px;">We ran the numbers. You're not gonna love this.</p>
        
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0 0 8px 0;"><strong>${r.tournamentName}</strong></p>
          <p style="margin: 0 0 8px 0;">Your <em>current</em> lineup finished in <strong>${r.currentRank}th</strong> place with ${formatCurrency(r.currentTotalWinnings)}.</p>
          <p style="margin: 0 0 12px 0;">But a lineup you <em>had before you changed it</em> would have finished <strong>${rankOrdinal}</strong> with ${formatCurrency(r.wouldBeTotalWinnings)} — in the money. 💸</p>
          <p style="margin: 0; font-size: 13px; color: #92400e;">That roster would have earned:</p>
        </div>
        ${r.wouldBePlayerWinnings?.length ? renderWouldBeRosterTable(r.wouldBePlayerWinnings) : ''}

        <p style="color: #6b7280; font-size: 14px;">
          Suuuuuuucks! But maybe next time... trust your instincts?
        </p>
        <p style="margin-top: 24px; color: #6b7280; text-align: center;">
          — ${r.username || 'FORE!SIGHT'}
        </p>
        <p style="margin-top: 8px; color: #fbbf24; font-weight: bold; text-align: center; font-size: 18px;">FORE!SIGHT</p>
      </div>
    `;

    try {
      const { error } = await resend.emails.send({
        from: 'FORE!SIGHT <andy@foresightgolfleague.com>',
        replyTo: 'arschuessler90@gmail.com',
        to: r.email,
        bcc: ['arschuessler90@gmail.com'],
        subject: `🤔 Your previous lineup would have finished ${rankOrdinal} — ${r.tournamentName}`,
        html: htmlContent,
      });
      if (error) {
        results.push({ email: r.email, success: false, error: error.message });
      } else {
        results.push({ email: r.email, success: true });
      }
    } catch (err) {
      results.push({
        email: r.email,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    success: true,
    tournamentId,
    recipientsCount: recipients.length,
    results,
  });
}
