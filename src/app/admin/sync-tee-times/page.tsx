import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { SyncTeeTimesForm } from '@/components/admin/SyncTeeTimesForm';

export default async function SyncTeeTimesPage() {
  // Auth is handled by Clerk middleware
  const supabase = createServiceClient();

  // Get all tournaments with their RapidAPI IDs
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, status, rapidapi_tourn_id, start_date')
    .order('start_date', { ascending: false });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Sync Tee Times & Scores
        </h1>
        <p className="text-casino-gray">
          Fetch latest data from RapidAPI including tee times, scores, and positions
        </p>
      </div>

      <Card className="mb-6 border-casino-blue/30">
        <CardContent className="pt-6">
          <h3 className="font-bold text-casino-text mb-2">
            ℹ️ How it works
          </h3>
          <ul className="space-y-2 text-sm text-casino-gray">
            <li>• Fetches current leaderboard data from RapidAPI</li>
            <li>• Updates tee times for Round 1 (available ~1-2 days before tournament)</li>
            <li>• Updates scores, positions, and made cut status during tournament</li>
            <li>• Cached for 3 minutes to prevent excessive API calls</li>
            <li>• Run this before tournament starts to populate tee times</li>
            <li>• During tournament, users' page visits will auto-sync every 3 minutes</li>
          </ul>
        </CardContent>
      </Card>

      <SyncTeeTimesForm tournaments={tournaments || []} />
    </div>
  );
}
