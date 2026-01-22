import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Calculate prize money for all tournaments that have both prize distributions and players
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Find all tournaments that have both prize distributions and tournament players
    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        prize_money_distributions(id),
        tournament_players(id)
      `);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 });
    }

    const results = [];

    for (const tournament of tournaments || []) {
      const hasPrizeDist = (tournament.prize_money_distributions as any)?.length > 0;
      const hasPlayers = (tournament.tournament_players as any)?.length > 0;

      if (hasPrizeDist && hasPlayers) {
        try {
          const calcResponse = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/scores/calculate-winnings`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tournamentId: tournament.id }),
            }
          );

          const calcResult = await calcResponse.json();
          results.push({
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            success: calcResponse.ok,
            result: calcResult
          });
        } catch (calcError) {
          results.push({
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            success: false,
            error: 'Failed to calculate'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${tournaments?.length || 0} tournaments, calculated winnings for ${results.length}`,
      results
    });
  } catch (error: any) {
    console.error('Error calculating all winnings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate winnings' },
      { status: 500 }
    );
  }
}