import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { shouldPollNow } from '@/lib/polling-config';

const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';

interface ESPNCompetitor {
  id: string;
  order: number;
  score?: string;
  athlete?: { fullName?: string; displayName?: string; shortName?: string };
  linescores?: Array<{ period: number; value?: number; displayValue?: string }>;
}

/**
 * GET  /api/scores/espn-sync (used by Vercel Cron)
 * POST /api/scores/espn-sync
 *
 * Fetches ESPN PGA scoreboard and populates espn_cache for tournaments
 * with espn_event_id set. Runs in parallel with auto-sync (RapidAPI).
 */
export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isDev = process.env.NODE_ENV === 'development';
    const isAuthorized = !cronSecret || authHeader === `Bearer ${cronSecret}` || isDev;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const pollStatus = shouldPollNow(now, { intervalMinutes: 2 });
    if (!pollStatus.shouldPoll) {
      return NextResponse.json({
        success: true,
        message: `ESPN sync skipped: ${pollStatus.reason}`,
        synced: 0,
        elapsedMs: Date.now() - startTime,
      });
    }

    // Random delay 60–150ms so ESPN fetch doesn't align with RapidAPI
    const delayMs = 60 + Math.floor(Math.random() * 90);
    await new Promise((r) => setTimeout(r, delayMs));

    const supabase = createServiceClient();

    const response = await fetch(ESPN_SCOREBOARD_URL, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `ESPN error: ${response.status}`, success: false },
        { status: 502 }
      );
    }

    const json = await response.json();
    const events = json.events || [];

    if (events.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No ESPN events in scoreboard',
        synced: 0,
        elapsedMs: Date.now() - startTime,
      });
    }

    // Get tournaments that have espn_event_id set
    const { data: tournamentsWithEspn, error: tError } = await supabase
      .from('tournaments')
      .select('id, name, espn_event_id')
      .not('espn_event_id', 'is', null);

    if (tError || !tournamentsWithEspn?.length) {
      return NextResponse.json({
        success: true,
        message: 'No tournaments with espn_event_id configured',
        synced: 0,
        elapsedMs: Date.now() - startTime,
      });
    }

    const espnEventIdToTournament = new Map(
      tournamentsWithEspn.map((t) => [t.espn_event_id, t])
    );

    let syncedCount = 0;

    for (const event of events) {
      const eventId = String(event.id);
      const tournament = espnEventIdToTournament.get(eventId);
      if (!tournament) continue;

      const competitions = event.competitions || [];
      const competition = competitions[0];
      if (!competition?.competitors) continue;

      const competitors = competition.competitors as ESPNCompetitor[];

      const transformedData = competitors.map((c) => {
        const name = c.athlete?.displayName || c.athlete?.fullName || c.athlete?.shortName || 'Unknown';
        const posNum = c.order || 0;
        return {
          player: name,
          playerId: String(c.id),
          position: String(posNum),
          positionValue: posNum,
          total: c.score ?? 'E',
          rounds: [],
          thru: 'F',
          currentRound: 1,
          currentRoundScore: null,
          teeTime: null,
          roundComplete: false,
          isAmateur: false,
        };
      });

      const status = competition.status?.type?.description || event.status?.type?.description || 'Unknown';
      const cacheKey = `espn-${eventId}`;

      const cacheData = {
        data: transformedData,
        source: 'espn',
        timestamp: Date.now(),
        tournamentStatus: status,
        currentRound: 1,
        lastUpdated: new Date().toISOString(),
        cutLine: null,
      };

      const { error: upsertError } = await supabase.from('espn_cache').upsert(
        {
          cache_key: cacheKey,
          tournament_id: tournament.id,
          data: cacheData,
          tournament_status: status,
          current_round: 1,
          player_count: transformedData.length,
        },
        { onConflict: 'cache_key' }
      );

      if (!upsertError) {
        syncedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedCount} event(s) from ESPN`,
      synced: syncedCount,
      eventsInResponse: events.length,
      elapsedMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[ESPN-SYNC] Error:', error);
    return NextResponse.json(
      { error: 'Unexpected error', success: false },
      { status: 500 }
    );
  }
}
