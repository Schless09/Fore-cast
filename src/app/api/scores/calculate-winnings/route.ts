import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { calculateTournamentWinnings } from '@/lib/calculate-winnings';

/**
 * Calculate prize money for all players in a tournament based on their final positions
 * This handles ties by splitting prize money appropriately
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

    const result = await calculateTournamentWinnings(supabase, tournamentId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: result.error === 'NO_PRIZE_DISTRIBUTION' ? 400 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      totalPurse: result.totalPurse,
    });
  } catch (error: unknown) {
    console.error('Error calculating winnings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate winnings' },
      { status: 500 }
    );
  }
}
