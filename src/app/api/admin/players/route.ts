import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Bulk import players into pga_players table
 * Expected payload: { players: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { players } = body;

    if (!players || !Array.isArray(players)) {
      return NextResponse.json(
        { error: 'players array is required' },
        { status: 400 }
      );
    }

    let created = 0;
    let skipped = 0;

    for (const playerName of players) {
      if (!playerName || typeof playerName !== 'string') {
        skipped++;
        continue;
      }

      // Check if player already exists (case-insensitive)
      const { data: existingPlayer } = await supabase
        .from('pga_players')
        .select('id')
        .ilike('name', playerName)
        .limit(1)
        .single();

      if (existingPlayer) {
        skipped++;
        continue;
      }

      // Create new player
      const { error: createError } = await supabase
        .from('pga_players')
        .insert({
          name: playerName.trim(),
          is_active: true,
        });

      if (createError) {
        console.error(`Error creating player ${playerName}:`, createError);
        skipped++;
        continue;
      }

      created++;
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${created} players (${skipped} skipped)`,
      created,
      skipped,
    });
  } catch (error: any) {
    console.error('Error importing players:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import players' },
      { status: 500 }
    );
  }
}
