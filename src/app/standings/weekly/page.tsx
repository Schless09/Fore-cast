import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = {
  title: 'Weekly Fantasy Golf Standings',
  description: 'Weekly fantasy golf standings and tournament results. Live leaderboard for your fantasy golf league.',
};

// Force fresh data on every request
export const revalidate = 0;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

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
    if (!completedTournament?.end_date) return false;
    
    // Only show completed tournament if we're before Monday noon CST
    return isBeforeMondayNoonCST();
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
