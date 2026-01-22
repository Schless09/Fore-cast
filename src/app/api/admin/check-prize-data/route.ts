import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Check prize distribution data for a tournament
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json({ error: 'tournamentId required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: prizeDistributions, error } = await supabase
      .from('prize_money_distributions')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('position', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tournamentId,
      prizeDistributions
    });
  } catch (error: any) {
    console.error('Error checking prize data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check prize data' },
      { status: 500 }
    );
  }
}