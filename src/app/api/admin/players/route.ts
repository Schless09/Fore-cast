import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Check what players exist in the database or tournament
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const tournamentId = searchParams.get('tournamentId');

    if (tournamentId) {
      // Check tournament players
      const { data: tournamentPlayers, error } = await supabase
        .from('tournament_players')
        .select(`
          id,
          pga_player_id,
          pga_players(name)
        `)
        .eq('tournament_id', tournamentId)
        .ilike('pga_players.name', `%${search}%`)
        .limit(10);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        tournamentPlayers: tournamentPlayers || [],
        count: tournamentPlayers?.length || 0,
      });
    } else {
      // Check PGA players
      const { data: players, error } = await supabase
        .from('pga_players')
        .select('id, name')
        .ilike('name', `%${search}%`)
        .limit(10);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        players: players || [],
        count: players?.length || 0,
      });
    }
  } catch (error: any) {
    console.error('Error searching players:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search players' },
      { status: 500 }
    );
  }
}

/**
 * Add players to a tournament
 */
export async function PATCH(request: NextRequest) {
  // DISABLED: Tournament player management is now handled via MCP
  return NextResponse.json({
    success: false,
    message: 'Tournament player creation disabled. Use MCP connection to manually manage tournament players.',
    error: 'Manual player management required'
  }, { status: 403 });
}

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
