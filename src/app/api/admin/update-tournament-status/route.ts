import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Update tournament status
 */
export async function POST(request: NextRequest) {
  try {
    const { tournamentId, status } = await request.json();

    if (!tournamentId || !status) {
      return NextResponse.json({ error: 'tournamentId and status required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('tournaments')
      .update({ status })
      .eq('id', tournamentId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tournament: data
    });
  } catch (error: any) {
    console.error('Error updating tournament status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update tournament status' },
      { status: 500 }
    );
  }
}