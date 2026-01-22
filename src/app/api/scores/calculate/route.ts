import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { calculateFantasyPoints } from '@/lib/scoring';

/**
 * Recalculate fantasy points for all rosters
 * This endpoint should be called when tournament scores are updated
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { tournamentId } = await request.json();

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      );
    }

    // Get all scoring rules
    const { data: scoringRules, error: rulesError } = await supabase
      .from('scoring_rules')
      .select('*');

    if (rulesError || !scoringRules) {
      return NextResponse.json(
        { error: 'Failed to load scoring rules' },
        { status: 500 }
      );
    }

    // Get all tournament players for this tournament
    const { data: tournamentPlayers, error: tpError } = await supabase
      .from('tournament_players')
      .select('*')
      .eq('tournament_id', tournamentId);

    if (tpError) {
      return NextResponse.json(
        { error: 'Failed to load tournament players' },
        { status: 500 }
      );
    }

    // Calculate fantasy points for each tournament player
    const updates = tournamentPlayers!.map((tp) => ({
      id: tp.id,
      fantasyPoints: calculateFantasyPoints(tp, scoringRules),
    }));

    // Update roster_players with new fantasy points
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('roster_players')
        .update({ fantasy_points: update.fantasyPoints })
        .eq('tournament_player_id', update.id);

      if (updateError) {
        console.error('Error updating roster player:', updateError);
      }
    }

    // Recalculate total fantasy points for all rosters in this tournament
    const { data: rosters, error: rostersError } = await supabase
      .from('user_rosters')
      .select('id, roster_players(fantasy_points)')
      .eq('tournament_id', tournamentId);

    if (!rostersError && rosters) {
      for (const roster of rosters) {
        const totalPoints =
          (roster.roster_players as any[])?.reduce(
            (sum: number, rp: any) => sum + (rp.fantasy_points || 0),
            0
          ) || 0;

        await supabase
          .from('user_rosters')
          .update({ total_fantasy_points: totalPoints })
          .eq('id', roster.id);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated fantasy points for ${updates.length} players`,
    });
  } catch (error: any) {
    console.error('Error calculating scores:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate scores' },
      { status: 500 }
    );
  }
}
