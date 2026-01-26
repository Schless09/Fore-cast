import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { acceptLeagueInvite } from '@/lib/actions/league';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface InvitePageProps {
  params: Promise<{ code: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const supabase = await createClient();

  // Check if user is authenticated first
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Fetch league info before redirecting (now using public RLS policies)
    console.log('[INVITE] Fetching invite with code:', code);
    
    const { data: invite, error: inviteError } = await supabase
      .from('league_invites')
      .select('league_id, is_active')
      .eq('invite_code', code)
      .eq('is_active', true)
      .maybeSingle();

    console.log('[INVITE] Invite query result:', { invite, inviteError });

    if (inviteError) {
      console.error('[INVITE] Error fetching invite:', inviteError);
      redirect(`/auth?invite=${code}`);
    }

    if (!invite) {
      console.log('[INVITE] No active invite found with code:', code);
      redirect(`/auth?invite=${code}`);
    }

    if (invite?.league_id) {
      console.log('[INVITE] Fetching league with id:', invite.league_id);
      
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('name')
        .eq('id', invite.league_id)
        .single();
      
      console.log('[INVITE] League query result:', { league, leagueError });
      
      if (leagueError) {
        console.error('[INVITE] Error fetching league:', leagueError);
        redirect(`/auth?invite=${code}`);
      }
      
      if (league?.name) {
        const redirectUrl = `/auth?invite=${code}&league=${encodeURIComponent(league.name)}`;
        console.log('[INVITE] Redirecting to:', redirectUrl);
        redirect(redirectUrl);
      }
    }
    
    // Fallback redirect without league name if fetch fails
    console.log('[INVITE] Falling back to redirect without league name');
    redirect(`/auth?invite=${code}`);
  }

  // User is authenticated, try to accept the invite
  const result = await acceptLeagueInvite(code);

  if (!result.success) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-900 via-green-900 to-gray-900 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-2xl text-red-400">❌ Invalid Invite</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-casino-gray mb-4">
              {result.error || 'This invite link is invalid or has expired.'}
            </p>
            <Link href="/leagues">
              <Button variant="primary" className="w-full">
                Go to Leagues
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success - redirect to dashboard
  redirect('/the-money-board?joined=true');
}
