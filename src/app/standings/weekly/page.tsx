import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { createServiceClient } from '@/lib/supabase/service';

export default async function WeeklyStandingsPage() {
  // Auth is handled by middleware
  const supabase = createServiceClient();

  // Priority:
  // 1) Active tournament (currently in progress)
  // 2) Most recent completed (if ended today or yesterday - to let users see final results)
  // 3) Next upcoming tournament
  // 4) Most recent completed (fallback)
  
  const { data: activeTournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('status', 'active')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: completedTournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('status', 'completed')
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: upcomingTournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('status', 'upcoming')
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Check if the completed tournament ended today or yesterday
  // If so, keep showing it to let users review final results
  const shouldShowCompletedTournament = () => {
    if (!completedTournament?.end_date) return false;
    
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
    
    // Extract just the date part from end_date
    const endDate = completedTournament.end_date.split('T')[0];
    
    // Show completed if it ended today or yesterday
    return endDate === today || endDate === yesterday;
  };

  let tournament;
  
  if (activeTournament) {
    // Active tournament takes priority
    tournament = activeTournament;
  } else if (shouldShowCompletedTournament()) {
    // Show completed tournament if it ended today or yesterday
    tournament = completedTournament;
  } else if (upcomingTournament) {
    // Otherwise show next upcoming
    tournament = upcomingTournament;
  } else {
    // Fallback to most recent completed
    tournament = completedTournament;
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
