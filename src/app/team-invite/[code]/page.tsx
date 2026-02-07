import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { acceptTeamInvite } from '@/lib/actions/league';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { createServiceClient } from '@/lib/supabase/service';

interface TeamInvitePageProps {
  params: Promise<{ code: string }>;
}

export default async function TeamInvitePage({ params }: TeamInvitePageProps) {
  const { code } = await params;
  const { userId } = await auth();

  if (!userId) {
    // Not authenticated - redirect to sign in with team invite code
    const supabase = createServiceClient();

    const { data: invite } = await supabase
      .from('team_invites')
      .select('league_id, owner_id, is_active')
      .eq('invite_code', code)
      .eq('is_active', true)
      .maybeSingle();

    if (invite?.owner_id) {
      // Get owner and league info for the signup page
      const [{ data: ownerProfile }, { data: league }] = await Promise.all([
        supabase.from('profiles').select('username').eq('id', invite.owner_id).single(),
        supabase.from('leagues').select('name').eq('id', invite.league_id).single(),
      ]);

      const teamInfo = ownerProfile?.username
        ? `${ownerProfile.username}'s team`
        : 'a team';
      const leagueInfo = league?.name || '';

      redirect(
        `/auth/signup?team_invite=${code}&team=${encodeURIComponent(teamInfo)}&league=${encodeURIComponent(leagueInfo)}`
      );
    }

    redirect(`/auth/signup?team_invite=${code}`);
  }

  // User is authenticated, try to accept the team invite
  const result = await acceptTeamInvite(code);

  if (!result.success) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-2xl text-red-400">Invalid Invite</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-casino-gray mb-4">
              {result.error || 'This co-manager invite link is invalid or has expired.'}
            </p>
            <Link href="/tournaments">
              <Button variant="primary" className="w-full">
                Go to Tournaments
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success - redirect to tournaments page
  redirect('/tournaments?team_joined=true');
}
