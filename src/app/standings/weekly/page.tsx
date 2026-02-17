import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth/profile';
import { Card, CardContent } from '@/components/ui/Card';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { createServiceClient } from '@/lib/supabase/service';
import { filterTournamentsIncludedInLeague } from '@/lib/league-utils';

export const metadata: Metadata = {
  title: 'Weekly Fantasy Golf Standings',
  description: 'Weekly fantasy golf standings and tournament results. Live leaderboard for your fantasy golf league.',
};

// Force fresh data on every request
export const revalidate = 0;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function WeeklyStandingsPage() {
  const profile = await getProfile();
  const supabase = createServiceClient();
  const userLeagueId = profile?.active_league_id ?? null;

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: false });

  const all = await filterTournamentsIncludedInLeague(
    supabase,
    userLeagueId,
    tournaments || []
  );

  // Same default logic as Tournaments page
  const active = all.filter((t) => t.status === 'active');
  const upcoming = all
    .filter((t) => t.status === 'upcoming')
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const completed = all
    .filter((t) => t.status === 'completed')
    .sort((a, b) => b.end_date.localeCompare(a.end_date));

  const isBeforeMondayNoonCST = () => {
    const now = new Date();
    const cstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const dayOfWeek = cstTime.getDay();
    const hour = cstTime.getHours();
    return dayOfWeek === 0 || (dayOfWeek === 1 && hour < 12);
  };

  const shouldShowCompletedTournament = completed.length > 0 && isBeforeMondayNoonCST();

  let tournament;

  if (active[0]) {
    tournament = active[0];
  } else if (shouldShowCompletedTournament) {
    tournament = completed[0];
  } else if (upcoming[0]) {
    tournament = upcoming[0];
  } else {
    tournament = completed[0];
  }

  if (!tournament) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-300">No tournaments available.</p>
            <Link href="/tournaments" className="mt-4 inline-block">
              <Button variant="outline">Browse Tournaments</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirect to tournament-specific standings page
  redirect(`/standings/weekly/${tournament.id}`);
}
