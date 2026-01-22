import { createClient } from '@/lib/supabase/server';
import { Tournament } from '@/lib/types';
import { TournamentsSwitcher } from '@/components/tournaments/TournamentsSwitcher';

export default async function TournamentsPage() {
  const supabase = await createClient();

  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) {
    console.error('Error loading tournaments:', error);
  }

  const all = (tournaments as Tournament[]) || [];

  const active = all.filter((t) => t.status === 'active');
  const upcoming = all.filter((t) => t.status === 'upcoming').sort((a, b) =>
    a.start_date.localeCompare(b.start_date)
  );
  const completed = all.filter((t) => t.status === 'completed').sort((a, b) =>
    b.start_date.localeCompare(a.start_date)
  );

  const currentTournament =
    active[0] ||
    upcoming[0] ||
    completed[0] ||
    null;

  const futureTournaments = upcoming.filter(
    (t) => !currentTournament || t.id !== currentTournament.id
  );

  const pastTournaments = completed;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Tournaments</h1>
        <p className="text-gray-300">
          Browse PGA Tour tournaments and create your rosters
        </p>
      </div>

      <TournamentsSwitcher
        currentTournament={currentTournament}
        futureTournaments={futureTournaments}
        pastTournaments={pastTournaments}
      />
    </div>
  );
}
