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
  try {
    const supabase = createServiceClient();
    const { tournamentId, playerNames } = await request.json();

    if (!tournamentId || !Array.isArray(playerNames)) {
      return NextResponse.json(
        { error: 'tournamentId and playerNames array are required' },
        { status: 400 }
      );
    }

    let added = 0;
    let skipped = 0;

    for (const playerName of playerNames) {
      // Find player by name (try exact match first, then partial)
      let { data: players } = await supabase
        .from('pga_players')
        .select('id, name')
        .ilike('name', playerName.trim())
        .limit(1);

      // If no exact match, try partial match
      if (!players || players.length === 0) {
        const { data: partialPlayers } = await supabase
          .from('pga_players')
          .select('id, name')
          .ilike('name', `%${playerName.trim()}%`)
          .limit(5);

        if (partialPlayers && partialPlayers.length > 0) {
          console.log(`Found partial matches for "${playerName}":`, partialPlayers.map(p => p.name));
          players = [partialPlayers[0]]; // Use first match
        }
      }

      if (!players || players.length === 0) {
        console.warn(`Player not found: ${playerName}`);
        skipped++;
        continue;
      }

      const playerId = players[0].id;

      // Check if already in tournament
      const { data: existing } = await supabase
        .from('tournament_players')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('pga_player_id', playerId)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Add to tournament with default cost
      const { error: insertError } = await supabase
        .from('tournament_players')
        .insert({
          tournament_id: tournamentId,
          pga_player_id: playerId,
          cost: 100.00, // Default cost (fits DECIMAL(5,2) constraint)
        });

      if (insertError) {
        console.error(`Error adding ${playerName}:`, insertError);
        skipped++;
        continue;
      }

      added++;
    }

    return NextResponse.json({
      success: true,
      message: `Added ${added} players to tournament (${skipped} skipped)`,
      added,
      skipped,
    });
  } catch (error: any) {
    console.error('Error adding players to tournament:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add players' },
      { status: 500 }
    );
  }
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
