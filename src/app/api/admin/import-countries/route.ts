import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Import country codes for players
 * POST /api/admin/import-countries
 * Body: { players: [{ name: string, country: string }] }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { players } = await request.json();
    
    if (!players || !Array.isArray(players)) {
      return NextResponse.json({ error: 'players array required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get all existing players
    const { data: dbPlayers, error: fetchError } = await supabase
      .from('pga_players')
      .select('id, name');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Create map of normalized names to IDs
    const playerMap = new Map<string, string>();
    dbPlayers?.forEach(p => playerMap.set(p.name.toLowerCase(), p.id));

    let updated = 0;
    let notFound = 0;
    const notFoundNames: string[] = [];

    for (const { name, country } of players) {
      if (!name || !country) continue;

      const playerId = playerMap.get(name.toLowerCase());

      if (playerId) {
        const { error: updateError } = await supabase
          .from('pga_players')
          .update({ country })
          .eq('id', playerId);

        if (!updateError) {
          updated++;
        } else {
          console.error(`Failed to update ${name}:`, updateError);
        }
      } else {
        notFound++;
        if (notFoundNames.length < 10) notFoundNames.push(name);
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        countriesUpdated: updated,
        notFound,
        notFoundSample: notFoundNames,
        durationMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import' },
      { status: 500 }
    );
  }
}
