import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { acceptLeagueInvite } from '@/lib/actions/league';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { createServiceClient } from '@/lib/supabase/service';

interface InvitePageProps {
  params: Promise<{ code: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const { userId } = await auth();

  if (!userId) {
    // Not authenticated - redirect to sign in with invite code
    // Fetch league info to show in auth page
    const supabase = createServiceClient();
    
    const { data: invite } = await supabase
      .from('league_invites')
      .select('league_id, is_active')
      .eq('invite_code', code)
      .eq('is_active', true)
      .maybeSingle();

    if (invite?.league_id) {
      const { data: league } = await supabase
        .from('leagues')
        .select('name')
        .eq('id', invite.league_id)
        .single();
      
      if (league?.name) {
        redirect(`/auth?invite=${code}&league=${encodeURIComponent(league.name)}`);
      }
    }
    
    redirect(`/auth?invite=${code}`);
  }

  // User is authenticated, try to accept the invite
  const result = await acceptLeagueInvite(code);

  if (!result.success) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-2xl text-red-400">Invalid Invite</CardTitle>
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
  redirect('/the-club-house?joined=true');
}
