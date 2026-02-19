import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { shouldPollNow } from '@/lib/polling-config';
import { assignPositionsByScore } from '@/lib/leaderboard-positions';

const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';

/** Derive round score to par from hole-by-hole scoreType displayValues (E, -1, +1, etc.) */
function deriveRoundScoreFromHoles(
  holeScores: Array<{ scoreType?: { displayValue?: string } }>
): string | null {
  if (!holeScores || holeScores.length === 0) return null;
  let total = 0;
  for (const h of holeScores) {
    const dv = h.scoreType?.displayValue;
    if (!dv) continue;
    if (dv === 'E') total += 0;
    else {
      const n = parseInt(dv, 10);
      if (!Number.isNaN(n)) total += n;
    }
  }
  if (total === 0) return 'E';
  if (total > 0) return `+${total}`;
  return String(total);
}

/** Format to-par value for display (E, +1, -2). */
function formatToPar(value: number): string {
  if (value === 0) return 'E';
  return value > 0 ? `+${value}` : String(value);
}

/** Normalize round displayValue from API (string or number) to display string. */
function normalizeRoundDisplay(raw: unknown): string | null {
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return formatToPar(raw);
  return null;
}

/**
 * ESPN sends full datetime strings in the tournament's timezone (e.g. "Thu Feb 19 10:15:00 PST 2026").
 * Store the raw string so the client can parse and display in the user's local timezone without
 * losing timezone info. Returns raw if it parses as a valid date; otherwise returns null.
 */
function normalizeTeeTimeFromESPN(raw: string): string | null {
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return raw; // Keep raw so client gets "Thu Feb 19 08:03:00 PST 2026" for accurate display
  } catch {
    return null;
  }
}

interface ESPNCompetitor {
  id: string;
  order: number;
  score?: string;
  athlete?: { fullName?: string; displayName?: string; shortName?: string };
  linescores?: Array<{
    period: number;
    value?: number;
    displayValue?: string;
    linescores?: Array<{ period: number; displayValue?: string; scoreType?: { displayValue?: string } }>;
    statistics?: {
      categories?: Array<{
        stats?: Array<{ value?: number; displayValue?: string }>;
      }>;
    };
  }>;
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

    /** Normalize name for matching: lowercase, remove leading "The ", collapse spaces. */
    const normalizeName = (s: string) =>
      (s || '').replace(/^the\s+/i, '').toLowerCase().replace(/\s+/g, ' ').trim();

    /** Auto-link: set espn_event_id on tournaments that match an ESPN event by date + name. */
    const eventDates = new Set(
      events.map((e: { date?: string; startDate?: string }) =>
        (e.date || e.startDate || '').slice(0, 10)
      )
    );
    const eventDateList = [...eventDates].filter(Boolean);
    if (eventDateList.length > 0) {
      const { data: candidates } = await supabase
        .from('tournaments')
        .select('id, name, start_date, espn_event_id')
        .in('start_date', eventDateList);

      const eventsByDate = new Map<string, Array<{ id: string; name?: string }>>();
      for (const e of events as { id: string; name?: string; date?: string; startDate?: string }[]) {
        const date = (e.date || e.startDate || '').slice(0, 10);
        if (!date) continue;
        if (!eventsByDate.has(date)) eventsByDate.set(date, []);
        eventsByDate.get(date)!.push({ id: e.id, name: e.name });
      }

      for (const t of candidates || []) {
        const dateStr = (t.start_date as string)?.slice(0, 10);
        const tName = normalizeName(t.name || '');
        if (!dateStr) continue;
        const dayEvents = eventsByDate.get(dateStr) || [];
        for (const ev of dayEvents) {
          const eName = normalizeName(ev.name || '');
          const nameMatch =
            eName.includes(tName) || tName.includes(eName) || eName === tName;
          if (nameMatch) {
            const newId = String(ev.id);
            if (t.espn_event_id === newId) break;
            await supabase
              .from('tournaments')
              .update({ espn_event_id: newId })
              .eq('id', t.id);
            break;
          }
        }
      }
    }

    // Get tournaments that have espn_event_id set (including newly auto-linked)
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
      const currentRoundNum = Number(competition.status?.period ?? event.status?.period ?? 1) || 1;
      const roundIndex = Math.max(0, currentRoundNum - 1);

      const transformedData = competitors.map((c) => {
        const name = c.athlete?.displayName || c.athlete?.fullName || c.athlete?.shortName || 'Unknown';
        const posNum = c.order || 0;
        // Resolve current round: by period match first, then by index (R1=0, R2=1, ...)
        const roundLines =
          c.linescores?.find((r) => Number(r.period) === currentRoundNum) ??
          c.linescores?.[roundIndex];
        const holeScores = roundLines?.linescores ?? [];
        const holesPlayed = holeScores.length;
        const firstHolePeriod = holeScores.length > 0
          ? Math.min(...holeScores.map((h) => h.period ?? 99))
          : 0;
        const startedBackNine = firstHolePeriod >= 10;
        let thru = holesPlayed >= 18 ? 'F' : String(holesPlayed);
        if (thru !== 'F' && startedBackNine) thru += '*';
        const stats = roundLines?.statistics?.categories?.[0]?.stats;
        const teeTimeRaw = stats?.length ? stats[stats.length - 1]?.displayValue : null;
        const teeTime = teeTimeRaw ? normalizeTeeTimeFromESPN(teeTimeRaw) : null;
        // Today's score: round displayValue (to par), then round value, then derived from holes
        const roundDisplay = normalizeRoundDisplay(
          (roundLines as Record<string, unknown> | undefined)?.displayValue
        );
        const roundValue =
          roundLines && typeof (roundLines as { value?: number }).value === 'number'
            ? (roundLines as { value: number }).value
            : null;
        const todayScore =
          roundDisplay ??
          (roundValue !== null ? formatToPar(roundValue) : null) ??
          deriveRoundScoreFromHoles(holeScores) ??
          null;
        return {
          player: name,
          playerId: String(c.id),
          position: String(posNum),
          positionValue: posNum,
          total: c.score ?? 'E',
          rounds: [],
          thru,
          currentRound: currentRoundNum,
          currentRoundScore: todayScore,
          teeTime,
          roundComplete: false,
          isAmateur: false,
          linescores: c.linescores ?? [],
        };
      });

      // Derive position from score (same as RapidAPI: tied players share position for prize split)
      const parseScore = (s: string | number | null): number => {
        if (s === null || s === undefined) return 0;
        if (typeof s === 'number') return s;
        if (s === 'E') return 0;
        const t = String(s).trim();
        if (t.startsWith('+')) return parseInt(t.slice(1), 10) || 0;
        if (t.startsWith('-')) return -(parseInt(t.slice(1), 10) || 0);
        return parseInt(t, 10) || 0;
      };
      const withScores = transformedData.map((row, index) => ({
        ...row,
        index,
        total_score: parseScore(row.total),
        today_score: parseScore(row.currentRoundScore),
        thru: row.thru ?? 'F',
      }));
      const positionResults = assignPositionsByScore(withScores);
      for (const { item, position, tieCount } of positionResults) {
        const row = transformedData[item.index];
        row.position = tieCount > 1 ? `T${position}` : String(position);
        row.positionValue = position;
      }

      const status = competition.status?.type?.description || event.status?.type?.description || 'Unknown';
      const cacheKey = `espn-${eventId}`;

      const cacheData = {
        data: transformedData,
        source: 'espn',
        timestamp: Date.now(),
        tournamentStatus: status,
        currentRound: currentRoundNum,
        lastUpdated: new Date().toISOString(),
        cutLine: null,
      };

      const { error: upsertError } = await supabase.from('espn_cache').upsert(
        {
          cache_key: cacheKey,
          tournament_id: tournament.id,
          data: cacheData,
          tournament_status: status,
          current_round: currentRoundNum,
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
