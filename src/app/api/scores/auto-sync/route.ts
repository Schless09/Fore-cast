import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Auto-sync endpoint for Vercel Cron
 * Automatically syncs scores for all active tournaments
 * Runs every 5 minutes via cron job
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    
    // Get all active tournaments (status = 'active')
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, livegolfapi_event_id')
      .eq('status', 'active')
      .not('livegolfapi_event_id', 'is', null);

    if (tournamentsError) {
      console.error('Error fetching tournaments:', tournamentsError);
      return NextResponse.json(
        { error: 'Failed to fetch tournaments' },
        { status: 500 }
      );
    }

    if (!tournaments || tournaments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active tournaments to sync',
        tournaments: [],
      });
    }

    const results = [];
    
    // Sync scores for each active tournament
    for (const tournament of tournaments) {
      try {
        console.log(`Syncing scores for tournament: ${tournament.name}`);
        
        const syncResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/scores/sync`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tournamentId: tournament.id,
              liveGolfAPITournamentId: tournament.livegolfapi_event_id,
            }),
          }
        );

        const syncResult = await syncResponse.json();
        
        results.push({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          success: syncResponse.ok,
          result: syncResult,
        });

        console.log(`Sync result for ${tournament.name}:`, syncResult);
      } catch (error) {
        console.error(`Error syncing tournament ${tournament.name}:`, error);
        results.push({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Auto-synced ${results.length} tournaments`,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error('Error in auto-sync:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-sync' },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
