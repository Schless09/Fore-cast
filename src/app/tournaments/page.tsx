import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth/profile';
import { createServiceClient } from '@/lib/supabase/service';
import { filterTournamentsIncludedInLeague } from '@/lib/league-utils';

export const metadata: Metadata = {
  title: 'Fantasy Golf Tournaments',
  description:
    'PGA Tour fantasy golf tournaments. Set your lineup, track live scores, and see weekly fantasy golf standings.',
};

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';

export default async function TournamentsPage() {
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

  // Find the current tournament
  const active = all.filter((t) => t.status === 'active');
  const upcoming = all.filter((t) => t.status === 'upcoming').sort((a, b) =>
    a.start_date.localeCompare(b.start_date)
  );
  const completed = all.filter((t) => t.status === 'completed').sort((a, b) =>
    b.end_date.localeCompare(a.end_date) // Most recent completed first
  );

  // Check if we should show the completed tournament
  // Show completed tournament until Monday noon CST, then switch to upcoming
  const isBeforeMondayNoonCST = () => {
    const now = new Date();
    // Convert to CST
    const cstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const dayOfWeek = cstTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = cstTime.getHours();
    
    // Before Monday noon: Sunday (day 0) or Monday before noon (day 1, hour < 12)
    return dayOfWeek === 0 || (dayOfWeek === 1 && hour < 12);
  };
  
  const shouldShowCompletedTournament = () => {
    if (completed.length === 0) return false;
    
    // Only show completed tournament if we're before Monday noon CST
    return isBeforeMondayNoonCST();
  };

  // Priority:
  // 1) Active tournament
  // 2) Most recent completed (if ended today or yesterday)
  // 3) Next upcoming tournament
  // 4) Most recent completed (fallback)
  let currentTournament;
  
  const showCompleted = shouldShowCompletedTournament();
  
  if (active[0]) {
    currentTournament = active[0];
  } else if (showCompleted) {
    currentTournament = completed[0];
  } else if (upcoming[0]) {
    currentTournament = upcoming[0];
  } else {
    currentTournament = completed[0];
  }

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
