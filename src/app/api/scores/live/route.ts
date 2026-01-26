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

// Tournament ID mapping (same as auto-sync)
const TOURNAMENT_ID_MAP: Record<string, { year: string; tournId: string }> = {
  '291e61c6-b1e4-49d6-a84e-99864e73a2be': { year: '2026', tournId: '002' }, // The American Express
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  
  // Allow direct year/tournId params for flexibility
  let year = searchParams.get('year');
  let tournId = searchParams.get('tournId');

  // If eventId provided, try to map it
  if (eventId && TOURNAMENT_ID_MAP[eventId]) {
    year = TOURNAMENT_ID_MAP[eventId].year;
    tournId = TOURNAMENT_ID_MAP[eventId].tournId;
  }

  if (!year || !tournId) {
    return NextResponse.json({ 
      error: 'Missing year and tournId parameters (or unknown eventId)',
      hint: 'Use ?year=2026&tournId=002 or ?eventId=<mapped-id>'
    }, { status: 400 });
  }

  const cacheKey = `${year}-${tournId}`;

  try {
    const supabase = createServiceClient();
    
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
