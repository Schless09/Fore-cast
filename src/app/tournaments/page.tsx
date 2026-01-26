import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';

export default async function TournamentsPage() {
  const supabase = createServiceClient();

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: false });

  const all = tournaments || [];

  // Find the current tournament
  const active = all.filter((t) => t.status === 'active');
  const upcoming = all.filter((t) => t.status === 'upcoming').sort((a, b) =>
    a.start_date.localeCompare(b.start_date)
  );
  const completed = all.filter((t) => t.status === 'completed').sort((a, b) =>
    b.end_date.localeCompare(a.end_date) // Most recent completed first
  );

  // Check if the most recent completed tournament ended today or yesterday
  // If so, keep showing it instead of jumping to the next upcoming
  const shouldShowCompletedTournament = () => {
    if (completed.length === 0) return false;
    
    const mostRecentCompleted = completed[0];
    if (!mostRecentCompleted.end_date) return false;
    
    // Get today's date in CST using Intl.DateTimeFormat for accurate timezone handling
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const today = formatter.format(now); // YYYY-MM-DD format
    
    // Get yesterday's date in CST
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterday = formatter.format(yesterdayDate);
    
    // Extract just the date part from end_date (handle both YYYY-MM-DD and ISO formats)
    const endDate = mostRecentCompleted.end_date.split('T')[0];
    
    console.log('[Tournaments] Date check:', { endDate, today, yesterday });
    
    // Show completed if it ended today or yesterday
    return endDate === today || endDate === yesterday;
  };

  // Priority:
  // 1) Active tournament
  // 2) Most recent completed (if ended today or yesterday)
  // 3) Next upcoming tournament
  // 4) Most recent completed (fallback)
  let currentTournament;
  
  const showCompleted = shouldShowCompletedTournament();
  console.log('[Tournaments] Selection:', { 
    hasActive: !!active[0], 
    showCompleted, 
    hasUpcoming: !!upcoming[0],
    completedName: completed[0]?.name,
    upcomingName: upcoming[0]?.name
  });
  
  if (active[0]) {
    currentTournament = active[0];
    console.log('[Tournaments] Showing active:', active[0].name);
  } else if (showCompleted) {
    currentTournament = completed[0];
    console.log('[Tournaments] Showing completed:', completed[0].name);
  } else if (upcoming[0]) {
    currentTournament = upcoming[0];
    console.log('[Tournaments] Showing upcoming:', upcoming[0].name);
  } else {
    currentTournament = completed[0];
    console.log('[Tournaments] Fallback to completed:', completed[0]?.name);
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
