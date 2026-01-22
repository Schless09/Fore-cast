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

  // Fetch the invite first
  const { data: invite, error: inviteError } = await supabase
    .from('league_invites')
    .select('id, league_id, is_active, expires_at')
    .eq('invite_code', code)
    .single();

  let leagueName = null;

  // If invite exists, fetch the league name
  if (invite && !inviteError) {
    const { data: league } = await supabase
      .from('leagues')
      .select('name')
      .eq('id', invite.league_id)
      .single();
    
    leagueName = league?.name;
  }

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Store invite code and league name, then redirect to signup
    const redirectUrl = leagueName 
      ? `/auth/signup?invite=${code}&league=${encodeURIComponent(leagueName)}`
      : `/auth/signup?invite=${code}`;
    redirect(redirectUrl);
  }

  // User is authenticated, try to accept the invite
  const result = await acceptLeagueInvite(code);

  if (!result.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 flex items-center justify-center px-4">
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
  redirect('/dashboard?joined=true');
}
