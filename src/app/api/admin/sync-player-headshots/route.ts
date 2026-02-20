import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { normalizeNameForLookup } from '@/lib/live-scores-prizes';

const ESPN_ATHLETE_URL = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/seasons';
const DELAY_MS = 180; // Rate limit between ESPN API calls

/**
 * POST /api/admin/sync-player-headshots
 * Backfill pga_players.image_url and espn_athlete_id from ESPN cache.
 * Reads all espn_cache rows, extracts competitor ids/names, fetches each athlete profile for headshot, matches to pga_players by name, updates.
 * Auth: Bearer CRON_SECRET or development.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === 'development';
  const isAuthorized = !cronSecret || authHeader === `Bearer ${cronSecret}` || isDev;
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const year = new Date().getFullYear();

  const { data: cacheRows } = await supabase
    .from('espn_cache')
    .select('data')
    .not('data', 'is', null);

  const seen = new Set<string>();
  const competitors: { id: string; player: string }[] = [];
  for (const row of cacheRows ?? []) {
    const data = row.data as { data?: Array<{ playerId?: string; player?: string }> };
    const list = data?.data ?? [];
    for (const c of list) {
      const id = String(c.playerId ?? '').trim();
      const player = (c.player ?? '').trim();
      if (id && player && !seen.has(id)) {
        seen.add(id);
        competitors.push({ id, player });
      }
    }
  }

  const { data: allPlayers } = await supabase.from('pga_players').select('id, name');
  const nameToPlayer = new Map<string, { id: string }>();
  for (const p of allPlayers ?? []) {
    const key = normalizeNameForLookup(p.name ?? '');
    if (key) nameToPlayer.set(key, { id: p.id });
  }

  let updated = 0;
  let errors = 0;

  for (let i = 0; i < competitors.length; i++) {
    const { id: athleteId, player } = competitors[i];
    await new Promise((r) => setTimeout(r, DELAY_MS));

    try {
      const res = await fetch(
        `${ESPN_ATHLETE_URL}/${year}/athletes/${athleteId}`,
        { headers: { Accept: 'application/json' }, cache: 'no-store' }
      );
      if (!res.ok) {
        errors++;
        continue;
      }
      const athlete = (await res.json()) as {
        headshot?: { href?: string };
        fullName?: string;
        displayName?: string;
      };
      const headshotHref = athlete.headshot?.href;
      const fullName = (athlete.fullName ?? athlete.displayName ?? player).trim();
      if (!headshotHref) continue;

      const key = normalizeNameForLookup(fullName);
      const match = nameToPlayer.get(key);
      if (!match) continue;

      const { error } = await supabase
        .from('pga_players')
        .update({ image_url: headshotHref, espn_athlete_id: athleteId })
        .eq('id', match.id);

      if (!error) updated++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({
    success: true,
    competitorsFromCache: competitors.length,
    updated,
    errors,
  });
}
