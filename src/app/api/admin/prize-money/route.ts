import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { parsePrizeMoneyTable } from '@/lib/prize-money';

/**
 * Import prize money distribution for a tournament
 * Expected payload: { tournamentId, totalPurse, distributions: [{ position, percentage, amount, tied_2, tied_3, ... }] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { tournamentId, totalPurse, distributions } = body;

    if (!tournamentId || !totalPurse || !distributions || !Array.isArray(distributions)) {
      return NextResponse.json(
        { error: 'tournamentId, totalPurse, and distributions array are required' },
        { status: 400 }
      );
    }

    // Delete existing distributions for this tournament
    await supabase
      .from('prize_money_distributions')
      .delete()
      .eq('tournament_id', tournamentId);

    // Insert new distributions including pre-calculated tie amounts
    const distributionsToInsert = distributions.map((dist: any) => ({
      tournament_id: tournamentId,
      total_purse: totalPurse,
      position: dist.position,
      percentage: dist.percentage || null,
      amount: dist.amount,
      // Pre-calculated tie amounts from official PGA Tour data
      tied_2: dist.tied_2 || null,
      tied_3: dist.tied_3 || null,
      tied_4: dist.tied_4 || null,
      tied_5: dist.tied_5 || null,
      tied_6: dist.tied_6 || null,
      tied_7: dist.tied_7 || null,
      tied_8: dist.tied_8 || null,
      tied_9: dist.tied_9 || null,
      tied_10: dist.tied_10 || null,
    }));

    const { error: insertError } = await supabase
      .from('prize_money_distributions')
      .insert(distributionsToInsert);

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to insert prize money distributions: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Imported prize money distribution for ${distributions.length} positions`,
      totalPurse: totalPurse,
    });
  } catch (error: any) {
    console.error('Error importing prize money:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import prize money distribution' },
      { status: 500 }
    );
  }
}
