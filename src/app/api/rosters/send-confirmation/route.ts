import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/rosters/send-confirmation
 * Send a roster confirmation email to the user
 */
export async function POST(request: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Parse request body
  const body = await request.json();
  const { rosterId } = body as { rosterId: string };

  if (!rosterId) {
    return NextResponse.json({ success: false, error: 'rosterId is required' }, { status: 400 });
  }

  try {
    // Get roster details with players
    const { data: roster, error: rosterError } = await supabase
      .from('user_rosters')
      .select(`
        id,
        roster_name,
        budget_spent,
        budget_limit,
        user_id,
        tournaments (
          name
        ),
        roster_players (
          player_cost,
          tournament_players (
            pga_players (
              name,
              fedex_cup_ranking
            )
          )
        )
      `)
      .eq('id', rosterId)
      .single();

    if (rosterError || !roster) {
      console.error('Error fetching roster:', rosterError);
      return NextResponse.json({ success: false, error: 'Roster not found' }, { status: 404 });
    }

    // Get user's email from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, username')
      .eq('id', roster.user_id)
      .single();

    if (profileError || !profile?.email) {
      console.error('Error fetching profile or email not found:', profileError);
      return NextResponse.json({ success: false, error: 'User email not found' }, { status: 404 });
    }

    // Format players data (handle nested Supabase structure)
    const players = roster.roster_players.map((rp: unknown) => {
      const rosterPlayer = rp as {
        player_cost: number;
        tournament_players: {
          pga_players: {
            name: string;
            fedex_cup_ranking?: number;
          };
        } | {
          pga_players: {
            name: string;
            fedex_cup_ranking?: number;
          };
        }[];
      };

      // Handle both single object and array responses
      const tournamentPlayer = Array.isArray(rosterPlayer.tournament_players)
        ? rosterPlayer.tournament_players[0]
        : rosterPlayer.tournament_players;
      
      const pgaPlayer = Array.isArray(tournamentPlayer?.pga_players)
        ? tournamentPlayer.pga_players[0]
        : tournamentPlayer?.pga_players;

      return {
        name: pgaPlayer?.name || 'Unknown Player',
        cost: rosterPlayer.player_cost || 0.20,
        ranking: pgaPlayer?.fedex_cup_ranking,
      };
    });

    // Build simple HTML email
    const playerListHTML = players
      .map((p, i: number) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; text-align: left;">${i + 1}. ${p.name}</td>
          <td style="padding: 12px; text-align: right; font-weight: bold;">$${p.cost.toFixed(2)}</td>
        </tr>
      `)
      .join('');

    // Get tournament name (handle both array and object response)
    const tournaments = roster.tournaments as { name: string } | { name: string }[] | null;
    const tournamentName = Array.isArray(tournaments) 
      ? tournaments[0]?.name 
      : tournaments?.name;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #10b981; margin-bottom: 10px;">✅ Roster Submitted!</h1>
        <p style="color: #6b7280; margin-bottom: 30px;">Successfully submitted for ${tournamentName || 'Tournament'}</p>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0 0 10px 0;"><strong>Total Cost:</strong> $${roster.budget_spent.toFixed(2)} of $${roster.budget_limit.toFixed(2)}</p>
          <p style="margin: 0;"><strong>Players:</strong> ${players.length} of 10</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px; text-align: left; font-weight: 600;">Player</th>
              <th style="padding: 12px; text-align: right; font-weight: 600;">Cost</th>
            </tr>
          </thead>
          <tbody>
            ${playerListHTML}
          </tbody>
        </table>

        <p style="margin-top: 30px; color: #6b7280; text-align: center;">
          Good luck in the tournament, ${profile.username || roster.roster_name}!
        </p>
        <p style="margin-top: 10px; color: #fbbf24; font-weight: bold; text-align: center; font-size: 18px;">FORE!SIGHT</p>
      </div>
    `;

    // Send email using Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'FORE!SIGHT <andy@foresightgolfleague.com>',
      replyTo: 'arschuessler90@gmail.com',
      to: [profile.email],
      subject: `✅ Roster Submitted - ${tournamentName || 'Tournament'}`,
      html: htmlContent,
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      return NextResponse.json(
        { success: false, error: 'Failed to send confirmation email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, emailId: emailData?.id });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
