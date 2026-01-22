import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LeagueManager } from '@/components/leagues/LeagueManager';

export default async function LeaguesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get all leagues user is a member of
  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id, joined_at, leagues(id, name)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });

  // Get active league
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_league_id')
    .eq('id', user.id)
    .single();

  const leagues = memberships?.map(m => ({
    id: (m.leagues as any)?.id,
    name: (m.leagues as any)?.name,
    joined_at: m.joined_at
  })) || [];

  const activeLeagueId = profile?.active_league_id || null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          League Management
        </h1>
        <p className="text-casino-gray">
          Manage your leagues, create new ones, or join existing leagues
        </p>
      </div>

      <LeagueManager 
        initialLeagues={leagues} 
        initialActiveLeagueId={activeLeagueId}
      />
    </div>
  );
}
