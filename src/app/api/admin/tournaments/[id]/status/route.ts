import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/logger';

/**
 * Update tournament status
 * PUT /api/admin/tournaments/[id]/status
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceClient();
    const { id } = await params;
    const { status } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      );
    }

    if (!status || !['upcoming', 'active', 'completed'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required (upcoming, active, or completed)' },
        { status: 400 }
      );
    }

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .update({ status, last_updated: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update tournament status', {
        errorMessage: error.message,
        errorCode: error.code,
        tournamentId: id,
        newStatus: status,
      }, error as Error);
      return NextResponse.json(
        { error: `Failed to update tournament status: ${error.message}` },
        { status: 500 }
      );
    }

    logger.info('Tournament status updated successfully', {
      tournamentId: id,
      tournamentName: tournament.name,
      oldStatus: tournament.status,
      newStatus: status,
    });

    return NextResponse.json({
      success: true,
      tournament,
      message: `Tournament status updated to "${status}"`,
    });
  } catch (error: any) {
    logger.error('Unexpected error updating tournament status', {}, error);
    return NextResponse.json(
      { error: error.message || 'Failed to update tournament status' },
      { status: 500 }
    );
  }
}