import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Fetch live scores from server-side cache
 *
 * Supports two sources:
 * - ?source=espn&eventId=401811932 — ESPN cache (espn_cache), refreshed every 2 min
 * - ?eventId=004 or ?year=2026&tournId=002 — RapidAPI cache (live_scores_cache), daily sync
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supabase = createServiceClient();
  const source = searchParams.get('source'); // 'espn' | null (rapidapi)
  const eventId = searchParams.get('eventId');

  try {
    // ESPN cache — preferred for live scores (updated every 2 min)
    if (source === 'espn' && eventId) {
      const cacheKey = `espn-${eventId}`;
      const { data: cached, error: cacheError } = await supabase
        .from('espn_cache')
        .select('data, updated_at, tournament_status, current_round, player_count')
        .eq('cache_key', cacheKey)
        .single();

      if (cacheError && cacheError.code !== 'PGRST116') {
        console.error('[LiveScores] ESPN cache read error:', cacheError);
      }

      if (cached) {
        const cacheAge = Math.round((Date.now() - new Date(cached.updated_at).getTime()) / 1000);
        return NextResponse.json({
          ...cached.data,
          source: 'espn',
          cacheAge,
          cacheUpdatedAt: cached.updated_at,
        });
      }

      return NextResponse.json({
        data: [],
        source: 'espn',
        message: 'No ESPN cache for this event.',
        tournamentStatus: 'pending',
        timestamp: Date.now(),
      });
    }

    // RapidAPI cache
    let year = searchParams.get('year');
    let tournId = searchParams.get('tournId');

    if (eventId && (!year || !tournId)) {
      tournId = eventId;
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
        error: 'Missing parameters',
        hint: 'Use ?source=espn&eventId=401811932 or ?eventId=004 (RapidAPI)',
      }, { status: 400 });
    }

    const cacheKey = `${year}-${tournId}`;
    const { data: cached, error: cacheError } = await supabase
      .from('live_scores_cache')
      .select('data, updated_at, tournament_status, current_round, player_count')
      .eq('cache_key', cacheKey)
      .single();

    if (cacheError && cacheError.code !== 'PGRST116') {
      console.error('[LiveScores] Cache read error:', cacheError);
    }

    if (cached) {
      const cacheAge = Math.round((Date.now() - new Date(cached.updated_at).getTime()) / 1000);
      return NextResponse.json({
        ...cached.data,
        source: 'rapidapi',
        cacheAge,
        cacheUpdatedAt: cached.updated_at,
      });
    }

    return NextResponse.json({
      data: [],
      source: 'rapidapi',
      message: 'No cached data yet. ESPN sync runs every 2 min; RapidAPI daily.',
      tournamentStatus: 'pending',
      timestamp: Date.now(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch scores';
    console.error('[LiveScores] Error:', errorMessage);
    return NextResponse.json({ error: errorMessage, data: [] }, { status: 500 });
  }
}
