import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { SortableLeagueRoster } from '@/components/admin/SortableLeagueRoster';
import { createServiceClient } from '@/lib/supabase/service';

export default async function AdminLeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select(`
      id,
      name,
      created_at,
      created_by,
      profiles:created_by(username, email)
    `)
    .eq('id', id)
    .single();

  if (leagueError || !league) {
    notFound();
  }

  const { data: members, error: membersError } = await supabase
    .from('league_members')
    .select(`
      user_id,
      joined_at,
      profiles(id, username, email)
    `)
    .eq('league_id', id)
    .order('joined_at', { ascending: true });

  if (membersError) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-casino-red">Failed to load members.</p>
        <Link href="/admin/leagues" className="text-casino-gold hover:text-casino-gold/80 mt-4 inline-block">
          ← Back to Leagues
        </Link>
      </div>
    );
  }

  const creator = league.profiles as { username?: string; email?: string } | null;
  const creatorName =
    creator?.username || creator?.email?.split('@')[0] || creator?.email || '—';

  const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id);

  // Fetch co-managers for this league
  const { data: coMembers } = await supabase
    .from('team_co_members')
    .select(`
      co_member_id,
      created_at,
      owner_id,
      co_profile:profiles!team_co_members_co_member_id_fkey(id, username, email),
      owner_profile:profiles!team_co_members_owner_id_fkey(id, username)
    `)
    .eq('league_id', id);

  const coMemberIds = new Set((coMembers ?? []).map((cm: { co_member_id: string }) => cm.co_member_id));
  const allUserIds = [...new Set([...memberIds, ...coMemberIds])];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: pageViewByPath } = allUserIds.length > 0
    ? await supabase.rpc('get_page_view_counts_by_users_per_path', {
        p_user_ids: allUserIds,
        p_since: thirtyDaysAgo.toISOString(),
      })
    : { data: [] };

  const viewsByUser = new Map<
    string,
    { tournaments: number; standings_weekly: number; standings_season: number }
  >();
  (pageViewByPath ?? []).forEach((row: { user_id: string; tournaments: number; standings_weekly: number; standings_season: number }) => {
    viewsByUser.set(row.user_id, {
      tournaments: Number(row.tournaments) || 0,
      standings_weekly: Number(row.standings_weekly) || 0,
      standings_season: Number(row.standings_season) || 0,
    });
  });

  const memberRows = (members ?? []).map((m: any) => {
    const profile = m.profiles as { id: string; username?: string; email?: string } | null;
    const v = viewsByUser.get(m.user_id) ?? { tournaments: 0, standings_weekly: 0, standings_season: 0 };
    return {
      rowKey: `member-${m.user_id}`,
      user_id: m.user_id,
      username: profile?.username || 'Unknown',
      email: profile?.email || '',
      joined_at: m.joined_at,
      is_commissioner: m.user_id === league.created_by,
      role: 'member' as const,
      manages_team_of: undefined as string | undefined,
      views: v,
    };
  });

  const coManagerRows = (coMembers ?? []).map((cm: any) => {
    const coProfile = cm.co_profile as { id: string; username?: string; email?: string } | null;
    const ownerProfile = cm.owner_profile as { username?: string } | null;
    const v = viewsByUser.get(cm.co_member_id) ?? { tournaments: 0, standings_weekly: 0, standings_season: 0 };
    return {
      rowKey: `co-${cm.co_member_id}-${cm.owner_id}`,
      user_id: cm.co_member_id,
      username: coProfile?.username || 'Unknown',
      email: coProfile?.email || '',
      joined_at: cm.created_at,
      is_commissioner: false,
      role: 'co-manager' as const,
      manages_team_of: ownerProfile?.username || 'Unknown',
      views: v,
    };
  });

  const membersWithRole = [...memberRows, ...coManagerRows];


  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/admin/leagues"
          className="text-casino-gold hover:text-casino-gold/80 mb-4 inline-block"
        >
          ← Back to Leagues
        </Link>
        <h1 className="text-2xl font-bold text-white">{league.name}</h1>
        <p className="text-casino-gray mt-1">
          Commissioner: <span className="text-casino-text font-medium">{creatorName}</span>
        </p>
      </div>

      <Card className="bg-casino-card border-casino-gold/20">
        <CardHeader>
          <CardTitle className="text-casino-gold">
            League Roster ({membersWithRole.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SortableLeagueRoster members={membersWithRole} />
          {membersWithRole.length === 0 && (
            <p className="text-center text-casino-gray py-4">No members found</p>
          )}
          <p className="text-xs text-casino-gray mt-4">
            Views (30d): page loads per route
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
