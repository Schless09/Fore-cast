import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createServiceClient } from '@/lib/supabase/service';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function AdminLeaguesPage() {
  const supabase = createServiceClient();

  const { data: leagues, error: leaguesError } = await supabase
    .from('leagues')
    .select(`
      id,
      name,
      created_at,
      created_by,
      profiles:created_by(username, email)
    `)
    .order('created_at', { ascending: false });

  if (leaguesError) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-casino-red">Failed to load leagues: {leaguesError.message}</p>
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="mt-4 text-casino-gold hover:text-casino-gold/80">
            ← Back to Admin
          </Button>
        </Link>
      </div>
    );
  }

  const leagueIds = (leagues ?? []).map((l) => l.id);
  const { data: memberCounts } = await supabase
    .from('league_members')
    .select('league_id')
    .in('league_id', leagueIds)
    .limit(10000);

  const countByLeague: Record<string, number> = {};
  (memberCounts ?? []).forEach((row: { league_id: string }) => {
    countByLeague[row.league_id] = (countByLeague[row.league_id] ?? 0) + 1;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-casino-gold hover:text-casino-gold/80 mb-4 inline-block"
        >
          ← Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">All Leagues</h1>
        <p className="text-casino-gray">
          See who created each league and when. Click a league to view members and commissioner.
        </p>
      </div>

      {!leagues?.length ? (
        <Card className="bg-casino-card border-casino-gold/20">
          <CardContent className="py-12 text-center text-casino-gray">
            No leagues yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {leagues.map((league: any) => {
            const creator = league.profiles;
            const creatorName =
              creator?.username || creator?.email?.split('@')[0] || creator?.email || '—';
            const memberCount = countByLeague[league.id] ?? 0;
            return (
              <Link key={league.id} href={`/admin/leagues/${league.id}`}>
                <Card className="bg-casino-card border-casino-gold/20 hover:border-casino-gold/40 transition-colors cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-casino-text">{league.name}</p>
                        <p className="text-sm text-casino-gray mt-1">
                          Created {formatDate(league.created_at)}
                          {creatorName !== '—' && (
                            <> by <span className="font-medium text-casino-text">{creatorName}</span></>
                          )}
                        </p>
                        <p className="text-xs text-casino-gray mt-0.5">
                          {memberCount} member{memberCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="text-casino-gold text-sm">View members →</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
