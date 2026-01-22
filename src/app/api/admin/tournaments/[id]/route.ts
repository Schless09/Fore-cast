import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/logger';

/**
 * Delete a specific tournament
 * DELETE /api/admin/tournaments/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceClient();
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      );
    }

    // Get tournament name for logging
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('name')
      .eq('id', id)
      .single();

    // Delete the tournament (cascade will handle related records)
    const { error } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete tournament', {
        errorMessage: error.message,
        errorCode: error.code,
        tournamentId: id,
      }, error as Error);
      return NextResponse.json(
        { error: `Failed to delete tournament: ${error.message}` },
        { status: 500 }
      );
    }

    logger.info('Tournament deleted successfully', {
      tournamentId: id,
      tournamentName: tournament?.name,
    });

    return NextResponse.json({
      success: true,
      message: `Tournament "${tournament?.name || 'Unknown'}" deleted successfully`,
    });
  } catch (error: any) {
    logger.error('Unexpected error deleting tournament', {}, error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete tournament' },
      { status: 500 }
    );
  }
}
