import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * GET  /api/reminders/missing-rosters-late (used by Vercel Cron)
 * POST /api/reminders/missing-rosters-late
 * Late-night casual reminder for users who haven't submitted rosters.
 * Runs via Vercel Cron every Wednesday at 9pm CST (Thursday 03:00 UTC).
 */
export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isDev = process.env.NODE_ENV === 'development';
    const isAuthorized = !cronSecret || authHeader === `Bearer ${cronSecret}` || isDev;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const { data: upcomingTournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, start_date')
      .eq('status', 'upcoming')
      .gte('start_date', today.toISOString().split('T')[0])
      .lte('start_date', nextWeek.toISOString().split('T')[0])
      .order('start_date', { ascending: true });

    if (tournamentsError) {
      console.error('Error fetching tournaments:', tournamentsError);
      return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 });
    }

    if (!upcomingTournaments || upcomingTournaments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No upcoming tournaments found',
        emailsSent: 0,
        elapsedMs: Date.now() - startTime,
      });
    }

    let totalEmailsSent = 0;
    const results: Array<{ tournamentName: string; emailsSent: number }> = [];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://foresightgolfleague.com';

    for (const tournament of upcomingTournaments) {
      const { data: leagueMembers, error: membersError } = await supabase
        .from('league_members')
        .select(`
          user_id,
          league_id,
          profiles!league_members_user_id_fkey(id, email, username)
        `);

      if (membersError || !leagueMembers) continue;

      const { data: existingRosters, error: rostersError } = await supabase
        .from('user_rosters')
        .select('user_id')
        .eq('tournament_id', tournament.id);

      if (rostersError) continue;

      const userIdsWithRosters = new Set((existingRosters || []).map((r) => r.user_id));
      const membersWithoutRosters = leagueMembers.filter((member) => {
        const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
        return profile && !userIdsWithRosters.has(member.user_id);
      });

      for (const member of membersWithoutRosters) {
        const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
        if (!profile?.email) continue;

        const emailRecipients: string[] = [profile.email];
        const { data: coManagers } = await supabase
          .from('team_co_members')
          .select('profiles!team_co_members_co_member_id_fkey(email)')
          .eq('league_id', member.league_id)
          .eq('owner_id', member.user_id);

        if (coManagers?.length) {
          coManagers.forEach((cm: unknown) => {
            const co = cm as { profiles: { email: string } | { email: string }[] | null };
            const p = Array.isArray(co.profiles) ? co.profiles[0] : co.profiles;
            if (p?.email && !emailRecipients.includes(p.email)) emailRecipients.push(p.email);
          });
        }

        const username = profile.username || 'there';
        const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <p style="margin: 0 0 20px 0; color: #059669; font-weight: 800; font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase;">
            FORE!SIGHT
          </p>
      
          <h1 style="color: #111827; font-size: 24px; font-weight: 800; margin-bottom: 12px; line-height: 1.2;">
            The clock is ticking, ${username}. ⏳
          </h1>
      
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            The <strong>${tournament.name}</strong> is about to tee off. Don't be the person who forgets to set their lineup and gets stuck with a zero. 
          </p>
      
          <div style="margin-bottom: 32px;">
            <a href="${appUrl}/tournaments/${tournament.id}" 
               style="background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
              Set Your Roster
            </a>
          </div>
      
          <hr style="border: 0; border-top: 1px solid #f3f4f6; margin-bottom: 20px;" />
          <p style="color: #9ca3af; font-size: 13px; margin: 0;">
            Rosters lock strictly at tournament start. No mulligans.
          </p>
        </div>
      `;

        try {
          await resend.emails.send({
            from: 'FORE!SIGHT <andy@foresightgolfleague.com>',
            replyTo: 'arschuessler90@gmail.com',
            to: emailRecipients,
            bcc: ['arschuessler90@gmail.com'],
            subject: `Get your picks in — ${tournament.name}`,
            html: htmlContent,
          });
          totalEmailsSent += emailRecipients.length;
        } catch (emailError) {
          console.error(`Failed to send late reminder to ${profile.email}:`, emailError);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      results.push({ tournamentName: tournament.name, emailsSent: membersWithoutRosters.length });
    }

    return NextResponse.json({
      success: true,
      message: 'Late roster reminders sent',
      totalEmailsSent,
      tournaments: results,
      elapsedMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Unexpected error in missing-rosters-late:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
