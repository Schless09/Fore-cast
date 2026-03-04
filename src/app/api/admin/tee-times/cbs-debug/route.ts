import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { parseCBSLeaderboardHTML } from '@/lib/cbs-tee-times';

/**
 * GET /api/admin/tee-times/cbs-debug
 * Fetches CBS page and returns parse diagnostics (no DB writes).
 * Auth: Admin.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: profile } = await supabase.from('profiles').select('id').eq('clerk_id', userId).single();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await fetch('https://www.cbssports.com/golf/leaderboard/', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cache: 'no-store',
    });

    const html = await response.text();
    const rows = parseCBSLeaderboardHTML(html);

    const hasCellPlayerNameLong = html.includes('CellPlayerName--long');
    const hasGolfPlayers = html.includes('/golf/players/');
    const hasTaylorMoore = html.includes('Taylor Moore');

    return NextResponse.json({
      ok: true,
      status: response.status,
      htmlLength: html.length,
      rowsParsed: rows.length,
      hasCellPlayerNameLong,
      hasGolfPlayers,
      hasTaylorMoore,
      sampleNames: rows.slice(0, 5).map((r) => r.name),
      sampleRows: rows.slice(0, 3).map((r) => ({ name: r.name, r1: r.r1, r2: r.r2, isAmateur: r.isAmateur })),
      amateurRows: rows.filter((r) => r.isAmateur).map((r) => ({ name: r.name, r1: r.r1, r2: r.r2 })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}
