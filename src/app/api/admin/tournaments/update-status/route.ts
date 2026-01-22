import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Update tournament status (admin only)
 * Uses service client to bypass RLS
 */
export async function PATCH(request: NextRequest) {
  try {
    const { tournamentId, status } = await request.json();

    if (!tournamentId || !status) {
      return NextResponse.json(
        { error: 'tournamentId and status are required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['upcoming', 'active', 'completed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: upcoming, active, or completed' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Update tournament status using service role (bypasses RLS)
    const { data, error } = await supabase
      .from('tournaments')
      .update({ status })
      .eq('id', tournamentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating tournament status:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tournament: data,
      message: `Tournament status updated to "${status}"`,
    });
  } catch (error: any) {
    console.error('Unexpected error updating tournament status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update tournament status' },
      { status: 500 }
    );
  }
}
