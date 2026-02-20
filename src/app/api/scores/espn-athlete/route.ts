import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { normalizeNameForLookup } from '@/lib/live-scores-prizes';

const ESPN_ATHLETE_URL = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/seasons';

/**
 * GET /api/scores/espn-athlete?playerId=10140
 * Fetches PGA athlete profile from ESPN core API (headshot, name, etc.).
 * Used by ScorecardModal to show player image.
 * Also saves headshot URL to pga_players.image_url when we can match by name (and sets espn_athlete_id).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('playerId');

  if (!playerId) {
    return NextResponse.json(
      { error: 'Missing playerId', hint: 'Use ?playerId=10140' },
      { status: 400 }
    );
  }

  const year = new Date().getFullYear();
  const url = `${ESPN_ATHLETE_URL}/${year}/athletes/${playerId}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `ESPN athlete API error: ${response.status}` },
        { status: response.status === 404 ? 404 : 502 }
      );
    }

    const data = (await response.json()) as {
      headshot?: { href?: string; alt?: string };
      fullName?: string;
      displayName?: string;
      firstName?: string;
      lastName?: string;
    };

    const headshot = data.headshot?.href
      ? { href: data.headshot.href, alt: data.headshot.alt ?? data.fullName ?? 'Player' }
      : null;

    // Persist headshot to pga_players when we have a name match so we have it in our DB
    const fullName = data.fullName ?? data.displayName ?? null;
    if (headshot?.href && fullName) {
      try {
        const supabase = createServiceClient();
        const { data: players } = await supabase
          .from('pga_players')
          .select('id, name');
        const normalizedEspn = normalizeNameForLookup(fullName);
        const match = (players ?? []).find(
          (p) => normalizeNameForLookup(p.name ?? '') === normalizedEspn
        );
        if (match) {
          await supabase
            .from('pga_players')
            .update({
              image_url: headshot.href,
              espn_athlete_id: playerId,
            })
            .eq('id', match.id);
        }
      } catch (dbErr) {
        console.warn('[espn-athlete] Failed to save headshot to pga_players:', dbErr);
      }
    }

    return NextResponse.json({
      headshot,
      fullName: fullName ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
    });
  } catch (err) {
    console.error('[espn-athlete]', err);
    return NextResponse.json(
      { error: 'Failed to fetch athlete profile' },
      { status: 502 }
    );
  }
}
