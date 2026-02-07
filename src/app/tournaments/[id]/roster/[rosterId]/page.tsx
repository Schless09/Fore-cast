import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth/profile';
import { createServiceClient } from '@/lib/supabase/service';
import { PersonalLeaderboard } from '@/components/leaderboard/PersonalLeaderboard';
import { RosterWithDetails } from '@/lib/types';
import { canEditRoster as checkCanEditRoster } from '@/lib/league-utils';
import { CoMembersSection } from '@/components/roster/CoMembersSection';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface RosterPageProps {
  params: Promise<{ id: string; rosterId: string }>;
}

interface RosterPlayerRow {
  fantasy_points: number;
  [key: string]: unknown;
}

export default async function RosterPage({ params }: RosterPageProps) {
  const { id: tournamentId, rosterId } = await params;
  
  // Auth is handled by middleware
  const profile = await getProfile();
  if (!profile) {
    redirect('/auth');
  }
  
  const supabase = createServiceClient();

  // Load roster by ID (not filtered by user_id - we check access separately)
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

  // Check if user is authorized (owner or co-manager)
  const allowed = await checkCanEditRoster(
    supabase,
    profile.active_league_id,
    roster.user_id,
    profile.id
  );

  if (!allowed) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">You don&apos;t have access to this roster</p>
          <Link href="/tournaments">
            <Button variant="outline">Back to Tournaments</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isCoMember = roster.user_id !== profile.id;

  // If co-manager, get owner username
  let ownerUsername: string | null = null;
  if (isCoMember) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', roster.user_id)
      .single();
    ownerUsername = ownerProfile?.username || null;
  }

  // Sort roster players by fantasy points
  const sortedRoster = {
    ...roster,
    roster_players: (roster.roster_players || []).sort(
      (a: RosterPlayerRow, b: RosterPlayerRow) => b.fantasy_points - a.fantasy_points
    ),
  } as RosterWithDetails;

  // Check if tournament allows roster editing (upcoming status only)
  const canEdit = roster.tournament?.status === 'upcoming';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Co-member notice */}
      {isCoMember && ownerUsername && (
        <div className="mb-4 p-3 bg-casino-gold/10 border border-casino-gold/30 rounded-lg text-sm text-casino-gold">
          You&apos;re managing <strong>{ownerUsername}&apos;s</strong> team
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <Link href={`/tournaments/${tournamentId}`}>
          <Button variant="ghost" size="sm">← Back to Tournament</Button>
        </Link>
        
        {canEdit && (
          <Link href={`/tournaments/${tournamentId}`}>
            <Button variant="outline" size="sm">
              ✏️ Edit Roster
            </Button>
          </Link>
        )}
      </div>

      {canEdit && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          💡 You can edit your roster until the tournament starts
        </div>
      )}

      <PersonalLeaderboard
        rosterId={rosterId}
        initialRoster={sortedRoster}
      />

      {/* Co-member management - only shown to the roster owner */}
      {!isCoMember && profile.active_league_id && (
        <div className="mt-6">
          <CoMembersSection leagueId={profile.active_league_id} />
        </div>
      )}
    </div>
  );
}
