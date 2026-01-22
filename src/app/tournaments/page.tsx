import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function TournamentsPage() {
  const supabase = await createClient();

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: false });

  const all = tournaments || [];

  // Find the current tournament (active > upcoming > completed)
  const active = all.filter((t) => t.status === 'active');
  const upcoming = all.filter((t) => t.status === 'upcoming').sort((a, b) =>
    a.start_date.localeCompare(b.start_date)
  );
  const completed = all.filter((t) => t.status === 'completed');

  const currentTournament = active[0] || upcoming[0] || completed[0];

  // Redirect to the current tournament
  if (currentTournament) {
    redirect(`/tournaments/${currentTournament.id}`);
  }

  // Fallback if no tournaments exist
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Tournaments</h1>
        <p className="text-gray-300">
          No tournaments available at this time.
        </p>
      </div>
    </div>
  );
}
