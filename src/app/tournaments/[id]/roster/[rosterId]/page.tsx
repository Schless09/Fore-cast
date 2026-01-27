import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth/profile';
import { createServiceClient } from '@/lib/supabase/service';
import { PersonalLeaderboard } from '@/components/leaderboard/PersonalLeaderboard';
import { RosterWithDetails } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface RosterPageProps {
  params: Promise<{ id: string; rosterId: string }>;
}

export default async function RosterPage({ params }: RosterPageProps) {
  const { id: tournamentId, rosterId } = await params;
  
  // Auth is handled by middleware
  const profile = await getProfile();
  if (!profile) {
    redirect('/auth');
  }
  
  const supabase = createServiceClient();

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
    .eq('user_id', profile.id)
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

  // Check if tournament allows roster editing (upcoming status only)
  const canEditRoster = roster.tournament?.status === 'upcoming';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/tournaments/${tournamentId}`}>
          <Button variant="ghost" size="sm">← Back to Tournament</Button>
        </Link>
        
        {canEditRoster && (
          <Link href={`/tournaments/${tournamentId}`}>
            <Button variant="outline" size="sm">
              ✏️ Edit Roster
            </Button>
          </Link>
        )}
      </div>

      {canEditRoster && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          💡 You can edit your roster until the tournament starts
        </div>
      )}

      <PersonalLeaderboard
        rosterId={rosterId}
        initialRoster={sortedRoster}
      />
    </div>
  );
}
