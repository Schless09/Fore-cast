import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Bulk update tournament player scores
 * Expected payload: { tournamentId, players: [{ pgaPlayerId, scores }] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { tournamentId, players } = body;

    if (!tournamentId || !players || !Array.isArray(players)) {
      return NextResponse.json(
        { error: 'tournamentId and players array are required' },
        { status: 400 }
      );
    }

    const updates = [];

    for (const player of players) {
      const { pgaPlayerId, ...scoreData } = player;

      // Find tournament_player record
      const { data: tournamentPlayer, error: findError } = await supabase
        .from('tournament_players')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('pga_player_id', pgaPlayerId)
        .single();

      if (findError || !tournamentPlayer) {
        console.error(
          `Tournament player not found for pgaPlayerId: ${pgaPlayerId}`
        );
        continue;
      }

      // Update tournament player scores
      const { error: updateError } = await supabase
        .from('tournament_players')
        .update({
          ...scoreData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tournamentPlayer.id);

      if (updateError) {
        console.error('Error updating tournament player:', updateError);
        continue;
      }

      updates.push(pgaPlayerId);
    }

    // Trigger fantasy points recalculation
    // In production, you might want to use a queue/background job for this
    try {
      const recalcResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/scores/calculate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournamentId }),
        }
      );
    } catch (recalcError) {
      console.error('Error triggering recalculation:', recalcError);
      // Don't fail the request if recalculation fails
    }

    return NextResponse.json({
      success: true,
      message: `Updated scores for ${updates.length} players`,
      updatedPlayers: updates,
    });
  } catch (error: any) {
    console.error('Error updating scores:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update scores' },
      { status: 500 }
    );
  }
}
