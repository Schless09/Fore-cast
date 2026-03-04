import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/logger';

/**
 * Update tournament cut_count (admin only, service role).
 *
 * PATCH /api/admin/tournaments/[id]/cut-count
 * Body: { cutCount: number | null }
 *
 * - cutCount > 0 → sets tournaments.cut_count to that value (Top N and ties make the cut)
 * - cutCount null/undefined/'' → sets tournaments.cut_count to NULL (use default/no-cut logic)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceClient();
    const { id } = await params;
    const body = await request.json().catch(() => ({} as { cutCount?: unknown }));
    const { cutCount } = body as { cutCount?: number | null };

    if (!id) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      );
    }

    let cutValue: number | null = null;
    if (cutCount !== undefined && cutCount !== null) {
      if (typeof cutCount === 'number') {
        if (!Number.isInteger(cutCount) || cutCount <= 0) {
          return NextResponse.json(
            { error: 'cutCount must be a positive integer or null' },
            { status: 400 }
          );
        }
        cutValue = cutCount;
      } else {
        return NextResponse.json(
          { error: 'cutCount must be a number or null' },
          { status: 400 }
        );
      }
    } else {
      // Explicitly clear to NULL when cutCount is null/undefined
      cutValue = null;
    }

    const { data, error } = await supabase
      .from('tournaments')
      .update({ cut_count: cutValue })
      .eq('id', id)
      .select('id, name, cut_count')
      .single();

    if (error) {
      logger.error(
        'Failed to update tournament cut_count',
        {
          errorMessage: error.message,
          errorCode: error.code,
          tournamentId: id,
          cutCount: cutValue,
        },
        error as Error
      );
      return NextResponse.json(
        { error: `Failed to update cut count: ${error.message}` },
        { status: 500 }
      );
    }

    logger.info('Tournament cut_count updated successfully', {
      tournamentId: id,
      tournamentName: data?.name,
      cutCount: data?.cut_count,
    });

    return NextResponse.json({
      success: true,
      tournament: data,
      message:
        cutValue !== null
          ? `Cut set to Top ${cutValue} and ties for this tournament.`
          : 'Cut count cleared; default behavior will be used for this tournament.',
    });
  } catch (error: unknown) {
    logger.error(
      'Unexpected error updating tournament cut_count',
      {},
      error as Error
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update tournament cut count',
      },
      { status: 500 }
    );
  }
}

