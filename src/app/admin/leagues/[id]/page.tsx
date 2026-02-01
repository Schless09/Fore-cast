import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { createServiceClient } from '@/lib/supabase/service';

function formatJoinDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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

  const membersWithRole = (members ?? []).map((m: any) => {
    const profile = m.profiles as { id: string; username?: string; email?: string } | null;
    return {
      user_id: m.user_id,
      username: profile?.username || 'Unknown',
      email: profile?.email || '',
      joined_at: m.joined_at,
      is_commissioner: m.user_id === league.created_by,
    };
  });

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
            League Roster ({membersWithRole.length} members)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
                  <th className="px-2 sm:px-4 py-3">Username</th>
                  <th className="px-2 sm:px-4 py-3 hidden sm:table-cell">Email</th>
                  <th className="px-2 sm:px-4 py-3 hidden md:table-cell">Joined</th>
                  <th className="px-2 sm:px-4 py-3 text-center">Role</th>
                </tr>
              </thead>
              <tbody>
                {membersWithRole.map((member) => (
                  <tr
                    key={member.user_id}
                    className={`border-b border-casino-gold/10 transition-colors hover:bg-casino-elevated ${
                      member.is_commissioner ? 'bg-casino-gold/5' : ''
                    }`}
                  >
                    <td className="px-2 sm:px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-casino-text">
                          {member.username}
                        </span>
                        <span className="text-xs text-casino-gray sm:hidden">
                          {member.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-casino-gray hidden sm:table-cell">
                      {member.email}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-casino-gray hidden md:table-cell">
                      {formatJoinDate(member.joined_at)}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center">
                      {member.is_commissioner ? (
                        <span className="px-2 py-1 bg-casino-gold/20 text-casino-gold rounded text-xs font-medium">
                          Commissioner
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-casino-elevated text-casino-gray rounded text-xs">
                          Member
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {membersWithRole.length === 0 && (
            <p className="text-center text-casino-gray py-4">No members found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
