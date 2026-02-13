import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Fetch player scorecard from ESPN cache (espn_cache).
 * Reads raw linescores stored during espn-sync and derives the Scorecard shape.
 */

interface ESPNLineScore {
  period: number;
  value?: number;
  displayValue?: string;
  linescores?: Array<{
    period: number;
    value?: number;
    displayValue?: string;
    scoreType?: { displayValue?: string };
  }>;
}

function parseScoreToPar(dv: string | undefined): number {
  if (!dv) return 0;
  if (dv === 'E') return 0;
  const n = parseInt(dv, 10);
  return Number.isNaN(n) ? 0 : n;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const playerId = searchParams.get('playerId');

  if (!eventId || !playerId) {
    return NextResponse.json(
      { error: 'Missing required parameters', hint: 'Use ?eventId=401811932&playerId=<id>' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const cacheKey = `espn-${eventId}`;

  const { data: cacheRow, error: cacheError } = await supabase
    .from('espn_cache')
    .select('data, tournament_id')
    .eq('cache_key', cacheKey)
    .single();

  if (cacheError || !cacheRow) {
    return NextResponse.json(
      { error: 'ESPN cache not found for this event', data: null },
      { status: 404 }
    );
  }

  const cacheData = cacheRow.data as { data?: Array<{ playerId?: string; player?: string; linescores?: ESPNLineScore[] }> };
  const players = Array.isArray(cacheData?.data) ? cacheData.data : [];

  const player = players.find((p) => String(p.playerId) === String(playerId));
  if (!player) {
    return NextResponse.json(
      { error: 'Player not found in ESPN cache', data: null },
      { status: 404 }
    );
  }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('name, course')
    .eq('id', cacheRow.tournament_id)
    .single();

  const courseName = tournament?.course ?? '';
  const linescores = (player.linescores ?? []) as ESPNLineScore[];
  const rounds = linescores
    .filter((r) => r.linescores && r.linescores.length > 0)
    .map((r) => {
      const holesArray = (r.linescores ?? [])
        .filter((h) => h != null && h.period != null)
        .map((h) => {
          const strokes = typeof h.value === 'number' ? h.value : parseInt(String(h.displayValue ?? h.value ?? 0), 10) || 0;
          const scoreToPar = parseScoreToPar(h.scoreType?.displayValue);
          const par = strokes - scoreToPar;
          return {
            holeNumber: h.period,
            par,
            strokes,
            scoreToPar,
          };
        })
        .sort((a, b) => a.holeNumber - b.holeNumber);

      const roundStrokes = typeof r.value === 'number' ? r.value : holesArray.reduce((s, h) => s + Number(h.strokes), 0);
      const derivedRoundToPar = holesArray.reduce((s, h) => s + h.scoreToPar, 0);
      const roundScoreToParStr =
        r.displayValue != null && String(r.displayValue).trim() !== ''
          ? String(r.displayValue)
          : derivedRoundToPar === 0
            ? 'E'
            : derivedRoundToPar > 0
              ? `+${derivedRoundToPar}`
              : String(derivedRoundToPar);

      return {
        roundNumber: r.period,
        courseName,
        scoreToPar: roundScoreToParStr,
        strokes: roundStrokes,
        holes: holesArray,
        roundComplete: holesArray.length >= 18,
      };
    })
    .filter((r) => r.holes.length > 0) // Only include rounds with hole data
    .sort((a, b) => a.roundNumber - b.roundNumber);

  const totalScoreRaw = rounds.reduce((sum, r) => {
    const sv = r.scoreToPar;
    if (sv === 'E') return sum;
    const n = parseInt(String(sv).replace('+', ''), 10);
    return sum + (Number.isNaN(n) ? 0 : n);
  }, 0);

  let totalScore = String(totalScoreRaw);
  if (totalScoreRaw > 0) totalScore = `+${totalScoreRaw}`;
  else if (totalScoreRaw === 0) totalScore = 'E';

  const [firstName = '', ...lastParts] = (player.player ?? 'Unknown').split(/\s+/);
  const lastName = lastParts.join(' ') || firstName;

  const scorecard = {
    player: {
      id: playerId,
      firstName,
      lastName,
      country: '',
    },
    tournament: {
      name: tournament?.name ?? '',
      courseName: tournament?.course ?? '',
    },
    rounds,
    currentRound: rounds.length,
    totalScore,
  };

  return NextResponse.json({
    data: scorecard,
    source: 'espn',
  });
}
