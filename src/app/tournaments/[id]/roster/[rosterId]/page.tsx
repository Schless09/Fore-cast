import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PersonalLeaderboard } from '@/components/leaderboard/PersonalLeaderboard';
import { RosterWithDetails } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface RosterPageProps {
  params: Promise<{ id: string; rosterId: string }>;
}

export default async function RosterPage({ params }: RosterPageProps) {
  const { id: tournamentId, rosterId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  // Get roster with full details
  const { data: roster, error } = await supabase
    .from('user_rosters')
    .select(
      `
      *,
      tournament:tournaments(*),
      roster_players(
        *,
        tournament_player:tournament_players(
          *,
          pga_player:pga_players(*)
        )
      )
    `
    )
    .eq('id', rosterId)
    .eq('user_id', user.id)
    .single();

  if (error || !roster) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">Roster not found</p>
          <Link href="/tournaments">
            <Button variant="outline">Back to Tournaments</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Sort roster players by fantasy points
  const sortedRoster = {
    ...roster,
    roster_players: (roster.roster_players || []).sort(
      (a: any, b: any) => b.fantasy_points - a.fantasy_points
    ),
  } as RosterWithDetails;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/tournaments/${tournamentId}`}>
          <Button variant="ghost" size="sm">← Back to Tournament</Button>
        </Link>
      </div>

      <PersonalLeaderboard
        rosterId={rosterId}
        initialRoster={sortedRoster}
      />
    </div>
  );
}
