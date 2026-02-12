import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/reminders/missing-rosters
 * GET  /api/reminders/missing-rosters (used by Vercel Cron)
 * Send reminder emails to users who haven't submitted rosters for upcoming tournaments
 *
 * Runs via Vercel Cron every Wednesday at 3pm CST (9pm UTC / 21:00)
 * Note: Vercel Cron sends GET requests, so we handle both GET and POST.
 */
export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret or allow dev environment
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isDev = process.env.NODE_ENV === 'development';
    const isAuthorized = !cronSecret || authHeader === `Bearer ${cronSecret}` || isDev;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Find tournaments starting in the next 3 days (same as late reminder). Avoids e.g. Genesis 8 days out when cron runs in UTC.
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() + 3);

    const { data: upcomingTournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, start_date')
      .eq('status', 'upcoming')
      .gte('start_date', today.toISOString().split('T')[0])
      .lte('start_date', cutoff.toISOString().split('T')[0])
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
        elapsedMs: Date.now() - startTime
      });
    }

    let totalEmailsSent = 0;
    const results: Array<{ tournamentName: string; emailsSent: number }> = [];

    // Process each tournament
    for (const tournament of upcomingTournaments) {
      // Get all league members across all leagues
      const { data: leagueMembers, error: membersError } = await supabase
        .from('league_members')
        .select(`
          user_id,
          league_id,
          profiles!league_members_user_id_fkey(id, email, username, active_league_id)
        `);

      if (membersError || !leagueMembers) {
        console.error(`Error fetching league members for ${tournament.name}:`, membersError);
        continue;
      }

      // Get all existing rosters for this tournament
      const { data: existingRosters, error: rostersError } = await supabase
        .from('user_rosters')
        .select('user_id')
        .eq('tournament_id', tournament.id);

      if (rostersError) {
        console.error(`Error fetching rosters for ${tournament.name}:`, rostersError);
        continue;
      }

      const userIdsWithRosters = new Set(
        (existingRosters || []).map((r) => r.user_id)
      );

      // Find members without rosters
      const membersWithoutRosters = leagueMembers.filter((member) => {
        const profile = Array.isArray(member.profiles) 
          ? member.profiles[0] 
          : member.profiles;
        return profile && !userIdsWithRosters.has(member.user_id);
      });

      // Send reminders
      for (const member of membersWithoutRosters) {
        const profile = Array.isArray(member.profiles) 
          ? member.profiles[0] 
          : member.profiles;

        if (!profile?.email) continue;

        // Collect email recipients: owner + co-managers
        const emailRecipients: string[] = [profile.email];

        // Find co-managers
        const { data: coManagers } = await supabase
          .from('team_co_members')
          .select('profiles!team_co_members_co_member_id_fkey(email)')
          .eq('league_id', member.league_id)
          .eq('owner_id', member.user_id);

        if (coManagers && coManagers.length > 0) {
          coManagers.forEach((cm: unknown) => {
            const coMember = cm as {
              profiles: { email: string } | { email: string }[] | null;
            };
            
            const profileData = Array.isArray(coMember.profiles)
              ? coMember.profiles[0]
              : coMember.profiles;

            if (profileData?.email && !emailRecipients.includes(profileData.email)) {
              emailRecipients.push(profileData.email);
            }
          });
        }

        // Format start date
        const startDate = new Date(tournament.start_date);
        const formattedDate = startDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });

        // Build email HTML
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #f59e0b; margin-bottom: 10px;">⚠️ Roster Reminder</h1>
            <p style="color: #374151; font-size: 16px; margin-bottom: 30px;">
              Hey ${profile.username || 'there'}! You haven't submitted a roster yet for:
            </p>
            
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
              <h2 style="margin: 0 0 8px 0; color: #92400e; font-size: 20px;">${tournament.name}</h2>
              <p style="margin: 0; color: #78350f; font-size: 14px;">🏌️ Starts: ${formattedDate}</p>
            </div>

            <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
              Don't miss out! Submit your lineup before the tournament starts to compete for bragging rights and prizes.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://foresightgolfleague.com'}/tournaments/${tournament.id}" 
                 style="background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Create Your Roster
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px;">
              Good luck!
            </p>
            <p style="margin-top: 10px; color: #fbbf24; font-weight: bold; text-align: center; font-size: 18px;">FORE!SIGHT</p>
          </div>
        `;

        // Send email
        try {
          await resend.emails.send({
            from: 'FORE!SIGHT <andy@foresightgolfleague.com>',
            replyTo: 'arschuessler90@gmail.com',
            to: emailRecipients,
            bcc: ['arschuessler90@gmail.com'],
            subject: `⚠️ Don't forget your roster for ${tournament.name}`,
            html: htmlContent,
          });

          totalEmailsSent += emailRecipients.length;
        } catch (emailError) {
          console.error(`Failed to send email to ${profile.email}:`, emailError);
        }

        // Rate limit: wait 100ms between emails to avoid overwhelming Resend
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      results.push({
        tournamentName: tournament.name,
        emailsSent: membersWithoutRosters.length,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Roster reminders sent',
      totalEmailsSent,
      tournaments: results,
      elapsedMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Unexpected error in missing-rosters reminder:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
