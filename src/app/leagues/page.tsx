import { auth, currentUser } from '@clerk/nextjs/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LeagueManager } from '@/components/leagues/LeagueManager';
import { createServiceClient } from '@/lib/supabase/service';

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

  const leagues = memberships?.map(m => ({
    id: (m.leagues as any)?.id,
    name: (m.leagues as any)?.name,
    joined_at: m.joined_at,
    is_commissioner: (m.leagues as any)?.created_by === profile?.id,
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
