import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Check which tournaments have prize money setup and LiveGolfAPI event IDs
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        rapidapi_tourn_id,
        prize_money_distributions(id),
        tournament_players(id)
      `);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 });
    }

    const results = tournaments?.map(t => ({
      id: t.id,
      name: t.name,
      rapidapi_tourn_id: t.rapidapi_tourn_id,
      hasPrizeDistributions: (t.prize_money_distributions as any)?.length > 0,
      prizeDistributionCount: (t.prize_money_distributions as any)?.length || 0,
      hasPlayers: (t.tournament_players as any)?.length > 0,
      playerCount: (t.tournament_players as any)?.length || 0,
    })) || [];

    return NextResponse.json({
      success: true,
      tournaments: results,
      tournamentsWithPrizeMoney: results.filter(t => t.hasPrizeDistributions),
      tournamentsWithLiveGolfAPI: results.filter(t => t.rapidapi_tourn_id),
      tournamentsWithBoth: results.filter(t => t.hasPrizeDistributions && t.rapidapi_tourn_id),
    });
  } catch (error: any) {
    console.error('Error checking prize setup:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check prize setup' },
      { status: 500 }
    );
  }
}