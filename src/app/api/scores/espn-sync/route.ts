import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { shouldPollNow } from '@/lib/polling-config';
import { assignPositionsByScore } from '@/lib/leaderboard-positions';
import { syncTournamentScoresFromESPN } from '@/lib/sync-scores';
import { calculateTournamentWinnings } from '@/lib/calculate-winnings';

const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';
const ESPN_ATHLETE_BASE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/seasons';

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

/** Parse to-par string (E, +1, -2) to number. */
function parseScoreToNum(s: string | number | null): number {
  if (s === null || s === undefined) return 0;
  if (typeof s === 'number') return s;
  const t = String(s).trim();
  if (t === 'E') return 0;
  if (t.startsWith('+')) return parseInt(t.slice(1), 10) || 0;
  if (t.startsWith('-')) return -(parseInt(t.slice(1), 10) || 0);
  return parseInt(t, 10) || 0;
}

/** Sum round displayValues (E, +1, -2) for 36-hole to-par. */
function sumRoundsToPar(linescores: Array<{ period?: number; displayValue?: string | null }>): number | null {
  if (!linescores || linescores.length < 2) return null;
  const r1 = linescores.find((r) => Number(r.period) === 1);
  const r2 = linescores.find((r) => Number(r.period) === 2);
  const v1 = r1?.displayValue != null && r1.displayValue !== '-' ? parseScoreToNum(r1.displayValue) : null;
  const v2 = r2?.displayValue != null && r2.displayValue !== '-' ? parseScoreToNum(r2.displayValue) : null;
  if (v1 === null || v2 === null) return null;
  return v1 + v2;
}

/** Cut: top N and ties after 36 holes. Compute projected cut score from sorted leaderboard. */
function computeProjectedCut(
  withScores: Array<{ total_score: number; thru: string }>,
  currentRound: number,
  cutCount: number = 65
): { cutScore: string; cutCount: number } | null {
  if (currentRound > 2) return null; // Cut already made after R2
  const n = Math.max(1, cutCount);
  // Only players who have teed off
  const played = withScores.filter((r) => {
    const t = String(r.thru ?? '').trim();
    if (!t || t === '-' || t === '0') return false;
    if (t === 'F' || t === '18') return true;
    if (t.includes(':') || t.includes('AM') || t.includes('PM')) return false;
    const num = parseInt(t.replace('*', ''), 10);
    return !Number.isNaN(num) && num > 0;
  });
  if (played.length < n) return null;
  const sorted = [...played].sort((a, b) => a.total_score - b.total_score);
  const cutPosition = n - 1; // 0-based index for Nth player
  const cutScoreNum = sorted[cutPosition]?.total_score;
  if (cutScoreNum === undefined) return null;
  return {
    cutScore: formatToPar(cutScoreNum),
    cutCount: n,
  };
}

/** R3+: Compute actual cut score from 36-hole totals (top N and ties). */
function computeActualCutScore(
  players: Array<{ score_36: number | null }>,
  cutCount: number
): number | null {
  const n = Math.max(1, cutCount);
  const with36 = players.filter((p) => p.score_36 != null) as Array<{ score_36: number }>;
  if (with36.length < n) return null;
  const sorted = [...with36].sort((a, b) => a.score_36 - b.score_36);
  return sorted[n - 1]?.score_36 ?? null;
}

/** Player has valid R3 score (actively playing round 3) — definitive made-cut signal. */
function hasValidR3Score(linescores: Array<{ period?: number; displayValue?: string | null }> | undefined): boolean {
  if (!linescores) return false;
  const r3 = linescores.find((r) => Number(r.period) === 3);
  return r3 != null && r3.displayValue != null && r3.displayValue !== '-' && r3.displayValue !== '';
}

/** Normalize round displayValue from API (string or number) to display string. */
function normalizeRoundDisplay(raw: unknown): string | null {
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return formatToPar(raw);
  return null;
}

/**
 * ESPN sends full datetime strings but labels West Coast tournaments as PST/PDT.
 * PGA Tour tee times are actually in Eastern (TV broadcast standard). Fix the label.
 */
function normalizeTeeTimeFromESPN(raw: string): string | null {
  try {
    const fixed = raw
      .replace(/\bPST\b/g, 'EST')
      .replace(/\bPDT\b/g, 'EDT');
    const d = new Date(fixed);
    if (Number.isNaN(d.getTime())) return null;
    return fixed;
  } catch {
    return null;
  }
}

/** Fetch amateur status from ESPN athlete API. Returns undefined on fetch error. */
async function fetchAmateurFromAthleteApi(athleteId: string, year: number): Promise<boolean | undefined> {
  try {
    const url = `${ESPN_ATHLETE_BASE}/${year}/athletes/${athleteId}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { amateur?: boolean };
    return data.amateur === true;
  } catch {
    return undefined;
  }
}

/** Normalize name for DB lookup: lowercase, collapse spaces, strip diacritics. */
function normalizeNameForLookup(s: string): string {
  return (s || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Load amateur status: pga_players first, then ESPN athlete API for missing. Max 5 concurrent API requests. */
async function loadAmateurMap(
  competitors: Array<{ id: string; name: string }>,
  supabase: ReturnType<typeof createServiceClient>,
  year: number
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  const uniqueIds = [...new Set(competitors.map((c) => c.id))];

  const { data: players } = await supabase
    .from('pga_players')
    .select('espn_athlete_id, is_amateur')
    .in('espn_athlete_id', uniqueIds);
  for (const p of players ?? []) {
    if (p.espn_athlete_id != null) {
      map.set(String(p.espn_athlete_id), p.is_amateur === true);
    }
  }

  const missing = competitors.filter((c) => !map.has(c.id));
  const BATCH = 5;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((c) => fetchAmateurFromAthleteApi(c.id, year)));
    batch.forEach((c, j) => {
      const val = results[j];
      if (val !== undefined) map.set(c.id, val);
      else map.set(c.id, false); // default to pro on API error
    });
    if (i + BATCH < missing.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // Persist amateur to pga_players when we find a name match (backfill espn_athlete_id + is_amateur)
  if (missing.length > 0) {
    const { data: allPlayers } = await supabase.from('pga_players').select('id, name, espn_athlete_id');
    for (const c of missing) {
      const isAm = map.get(c.id) ?? false;
      const norm = normalizeNameForLookup(c.name);
      const match = (allPlayers ?? []).find(
        (p) => !p.espn_athlete_id && normalizeNameForLookup(p.name ?? '') === norm
      );
      if (match) {
        await supabase
          .from('pga_players')
          .update({ espn_athlete_id: c.id, is_amateur: isAm })
          .eq('id', match.id);
      }
    }
  }
  return map;
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
    const url = request.nextUrl ?? new URL(request.url);
    const force = url.searchParams.get('force') === 'true';
    const pollStatus = shouldPollNow(now, { intervalMinutes: 2 });
    if (!force && !pollStatus.shouldPoll) {
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
      .select('id, name, espn_event_id, cut_count, status')
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

      const year = now.getFullYear();
      const competitorMeta = competitors.map((c) => {
        const name = c.athlete?.displayName || c.athlete?.fullName || c.athlete?.shortName || 'Unknown';
        return { id: String(c.id), name };
      });
      const amateurMap = await loadAmateurMap(competitorMeta, supabase, year);

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
        const score36 = sumRoundsToPar(c.linescores ?? []);
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
          isAmateur: amateurMap.get(String(c.id)) ?? false,
          linescores: c.linescores ?? [],
          score_36: score36 ?? undefined,
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
        score_36: (row as { score_36?: number }).score_36 ?? null,
      }));
      // R3+: Made cut = (a) has valid R3 score (actively playing) OR (b) 36-hole <= cut score.
      // (a) catches players like Harman; (b) catches leaders who haven't teed off yet (R3 = "-").
      const cutCount = tournament.cut_count ?? 65;
      const hasCut = tournament.cut_count != null;
      const actualCutScoreNum = hasCut && currentRoundNum > 2 ? computeActualCutScore(withScores, cutCount) : null;
      const madeCutByIndex = new Map<number, boolean>();
      if (hasCut && currentRoundNum > 2) {
        withScores.forEach((r, i) => {
          const playingR3 = hasValidR3Score(r.linescores);
          const s36 = (r as { score_36?: number | null }).score_36;
          const byScore = actualCutScoreNum != null && s36 != null && s36 <= actualCutScoreNum;
          // When cut score unknown, include all (don't mark anyone MC)
          madeCutByIndex.set(i, actualCutScoreNum == null ? true : playingR3 || byScore);
        });
      }
      const toRank = hasCut && currentRoundNum > 2 && actualCutScoreNum != null
        ? withScores.filter((_, i) => madeCutByIndex.get(i))
        : withScores;
      const positionResults = assignPositionsByScore(toRank);
      const positionByIndex = new Map<number, { position: number; tieCount: number }>();
      for (const { item, position, tieCount } of positionResults) {
        positionByIndex.set(item.index, { position, tieCount });
      }
      for (let i = 0; i < transformedData.length; i++) {
        const row = transformedData[i];
        const pr = positionByIndex.get(i);
        const madeCut = currentRoundNum <= 2 || !hasCut || madeCutByIndex.get(i) !== false;
        if (madeCut && pr) {
          row.position = pr.tieCount > 1 ? `T${pr.position}` : String(pr.position);
          row.positionValue = pr.position;
        } else if (!madeCut && hasCut && currentRoundNum > 2) {
          row.position = 'MC';
          (row as { positionValue?: number }).positionValue = undefined;
        }
      }

      const status = competition.status?.type?.description || event.status?.type?.description || 'Unknown';
      const cacheKey = `espn-${eventId}`;

      const projectedCut = hasCut ? computeProjectedCut(withScores, currentRoundNum, cutCount) : null;
      const cutLine = hasCut
        ? (projectedCut ?? (currentRoundNum > 2 && actualCutScoreNum != null
          ? { cutScore: formatToPar(actualCutScoreNum), cutCount }
          : currentRoundNum > 2 ? { cutScore: '—', cutCount } : null))
        : null;

      const cacheData = {
        data: transformedData,
        source: 'espn',
        timestamp: Date.now(),
        tournamentStatus: status,
        currentRound: currentRoundNum,
        lastUpdated: new Date().toISOString(),
        cutLine,
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

      // When ESPN signals tournament complete, mark completed and finalize prize money
      const statusCompleted =
        (competition.status?.type as { completed?: boolean } | undefined)?.completed === true ||
        (event.status?.type as { completed?: boolean } | undefined)?.completed === true ||
        /final|official/i.test(status || '');
      if (statusCompleted && tournament.status === 'active') {
        await supabase
          .from('tournaments')
          .update({ status: 'completed' })
          .eq('id', tournament.id)
          .eq('status', 'active');
        const syncResult = await syncTournamentScoresFromESPN(supabase, tournament.id);
        if (syncResult.success) {
          await calculateTournamentWinnings(supabase, tournament.id);
        }
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
