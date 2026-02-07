import type { Metadata } from 'next';
import { auth, currentUser } from '@clerk/nextjs/server';
import { LeagueManager } from '@/components/leagues/LeagueManager';
import { createServiceClient } from '@/lib/supabase/service';

interface LeagueRow {
  id: string;
  name: string;
  created_by: string | null;
}

export const metadata: Metadata = {
  title: 'Fantasy Golf Leagues',
  description:
    'Create or join a fantasy golf league. Manage your league, invite friends, and compete in FORE!SIGHT fantasy golf.',
};

async function getProfileForClerkUser() {
  const { userId } = await auth();
  
  if (!userId) {
    return null;
  }

  const user = await currentUser();
  if (!user) {
    return null;
  }

  const supabase = createServiceClient();
  
  // Try to find existing profile by clerk_id
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_id', userId)
    .single();

  if (existingProfile) {
    return existingProfile;
  }

  // Create profile if it doesn't exist
  const email = user.emailAddresses?.[0]?.emailAddress || '';
  const username = user.username || user.firstName || email.split('@')[0];
  
  const { data: newProfile, error: createError } = await supabase
    .from('profiles')
    .insert({
      clerk_id: userId,
      email: email,
      username: username,
    })
    .select()
    .single();

  if (createError) {
    console.error('Error creating profile:', createError);
    return null;
  }

  return newProfile;
}

export default async function LeaguesPage() {
  // Auth is handled by middleware, but we need the profile for data access
  const profile = await getProfileForClerkUser();

  const supabase = createServiceClient();

  // Get all leagues user is a member of
  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id, joined_at, leagues(id, name, created_by)')
    .eq('user_id', profile?.id)
    .order('joined_at', { ascending: false });

  const leagues = memberships?.map(m => {
    const raw = m.leagues as LeagueRow | LeagueRow[] | null;
    const league = Array.isArray(raw) ? raw[0] ?? null : raw;
    return {
      id: league?.id ?? '',
      name: league?.name ?? '',
      joined_at: m.joined_at,
      is_commissioner: league?.created_by === profile?.id,
    };
  }) || [];

  const activeLeagueId = profile?.active_league_id || null;

  // Get teams the user co-manages
  const { data: coManagedTeams } = await supabase
    .from('team_co_members')
    .select(`
      id,
      league_id,
      owner_id,
      created_at,
      leagues:league_id(id, name),
      profiles!team_co_members_owner_id_fkey(id, username)
    `)
    .eq('co_member_id', profile?.id);

  const coManagedData = (coManagedTeams || []).map((cm) => {
    const league = Array.isArray(cm.leagues) ? cm.leagues[0] : cm.leagues;
    const owner = cm.profiles as unknown as { id: string; username: string } | null;
    return {
      id: cm.id,
      leagueId: league?.id ?? '',
      leagueName: league?.name ?? '',
      ownerId: cm.owner_id,
      ownerUsername: owner?.username ?? 'Unknown',
      createdAt: cm.created_at,
    };
  });

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
        coManagedTeams={coManagedData}
      />
    </div>
  );
}
