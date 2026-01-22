import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency } from '@/lib/prize-money';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default async function WeeklyStandingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  // Priority:
  // 1) Active tournament (currently in progress)
  // 2) After Monday noon CST: Next upcoming tournament
  // 3) Before Monday noon CST: Most recent completed tournament
  
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
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: upcomingTournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('status', 'upcoming')
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Check if it's after Monday noon CST
  const isAfterMondayNoonCST = () => {
    const now = new Date();
    const cstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const dayOfWeek = cstTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = cstTime.getHours();
    
    // After Monday noon: Monday after 12pm, or any day Tuesday-Sunday
    return dayOfWeek === 1 ? hour >= 12 : dayOfWeek !== 0;
  };

  let tournament;
  
  if (activeTournament) {
    // Active tournament takes priority
    tournament = activeTournament;
  } else if (isAfterMondayNoonCST()) {
    // After Monday noon CST: show next upcoming tournament
    tournament = upcomingTournament || completedTournament;
  } else {
    // Before Monday noon CST: show most recent completed tournament
    tournament = completedTournament || upcomingTournament;
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
