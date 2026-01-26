import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Fetch live scores from server-side cache
 * 
 * This endpoint reads from the Supabase cache that's populated by the
 * auto-sync cron job. This means:
 * - No API calls are made per user request
 * - All users see the same cached data
 * - Data freshness depends on the smart polling schedule
 * 
 * The cron job polls RapidAPI based on tournament schedule:
 * - Thu/Fri: Every 10 minutes
 * - Saturday: Every 5 minutes  
 * - Sunday: Every 3 minutes
 * - Off-hours: No polling
 */

// rapidapi_tourn_id stores the RapidAPI tournId directly (e.g., "002", "004")

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supabase = createServiceClient();
  
  // Accept either:
  // - ?year=2026&tournId=002 (direct params)
  // - ?eventId=004 (will look up year from tournament)
  let year = searchParams.get('year');
  let tournId = searchParams.get('tournId');
  const eventId = searchParams.get('eventId');

  // If eventId provided, look up the tournament to get year
  if (eventId && (!year || !tournId)) {
    tournId = eventId;
    
    // Look up tournament by rapidapi_tourn_id to get the year
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('start_date')
      .eq('rapidapi_tourn_id', eventId)
      .single();
    
    if (tournament?.start_date) {
      year = new Date(tournament.start_date).getFullYear().toString();
    }
  }

  if (!year || !tournId) {
    return NextResponse.json({ 
      error: 'Missing year and tournId parameters',
      hint: 'Use ?year=2026&tournId=002 or ?eventId=004'
    }, { status: 400 });
  }

  const cacheKey = `${year}-${tournId}`;

  try {
    // Read from cache
    const { data: cached, error: cacheError } = await supabase
      .from('live_scores_cache')
      .select('data, updated_at, tournament_status, current_round, player_count')
      .eq('cache_key', cacheKey)
      .single();

    if (cacheError && cacheError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[LiveScores] Cache read error:', cacheError);
    }

    if (cached) {
      const cacheAge = Math.round((Date.now() - new Date(cached.updated_at).getTime()) / 1000);
      
      console.log(`[LiveScores] ✅ Returning cached data (${cacheAge}s old, ${cached.player_count} players)`);
      
      return NextResponse.json({
        ...cached.data,
        source: 'cache',
        cacheAge: cacheAge,
        cacheUpdatedAt: cached.updated_at,
      });
    }

    // No cache - return empty response with helpful message
    // The cron job will populate this once it runs during tournament hours
    console.log(`[LiveScores] ⚠️ No cached data for ${cacheKey}`);
    
    return NextResponse.json({
      data: [],
      source: 'cache',
      message: 'No cached data available yet. Data will be available once the tournament begins and the auto-sync runs.',
      tournamentStatus: 'pending',
      timestamp: Date.now(),
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch scores';
    console.error('[LiveScores] Error:', errorMessage);
    return NextResponse.json(
      { error: errorMessage, data: [] },
      { status: 500 }
    );
  }
}
