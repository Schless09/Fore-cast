import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { userId } = await auth();
  const supabase = createServiceClient();

  try {
    // Fetch invite
    const { data: invite, error: inviteError } = await supabase
      .from('league_invites')
      .select('league_id, is_active, created_at, expires_at')
      .eq('invite_code', code)
      .eq('is_active', true)
      .maybeSingle();

    let league = null;
    let leagueError = null;

    // If invite exists, fetch league
    if (invite?.league_id) {
      const result = await supabase
        .from('leagues')
        .select('id, name')
        .eq('id', invite.league_id)
        .single();
      
      league = result.data;
      leagueError = result.error;
    }

    return NextResponse.json({
      debug: {
        inviteCode: code,
        isAuthenticated: !!userId,
        invite: invite,
        inviteError: inviteError?.message || null,
        league: league,
        leagueError: leagueError?.message || null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
