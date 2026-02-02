import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/logger';
import { syncTournamentScores } from '@/lib/sync-scores';
import { calculateTournamentWinnings } from '@/lib/calculate-winnings';

/**
 * Update tournament status
 * PUT /api/admin/tournaments/[id]/status
 * 
 * When changing to "completed", automatically:
 * 1. Syncs final scores/positions from LiveGolfAPI
 * 2. Calculates and saves final winnings
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

    // Get current status before update
    const { data: currentTournament } = await supabase
      .from('tournaments')
      .select('status')
      .eq('id', id)
      .single();

    const previousStatus = currentTournament?.status;

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
      oldStatus: previousStatus,
      newStatus: status,
    });

    // When changing to "completed", sync scores first then calculate winnings
    let syncResult = null;
    let winningsResult = null;
    
    if (status === 'completed') {
      // Step 1: Sync final scores/positions from API (if tournament has API ID)
      if (tournament.rapidapi_tourn_id) {
        logger.info('Auto-syncing final scores for completed tournament', {
          tournamentId: id,
          tournamentName: tournament.name,
          apiId: tournament.rapidapi_tourn_id,
        });

        syncResult = await syncTournamentScores(supabase, id, tournament.rapidapi_tourn_id);

        if (syncResult.success) {
          logger.info('Scores synced successfully', {
            tournamentId: id,
            playersUpdated: syncResult.playersUpdated,
          });
        } else {
          logger.warn('Failed to sync scores (continuing with winnings calculation)', {
            tournamentId: id,
            error: syncResult.message,
          });
        }
      } else {
        logger.warn('Tournament has no API ID, skipping score sync', {
          tournamentId: id,
          tournamentName: tournament.name,
        });
      }

      // Step 2: Calculate winnings based on positions
      logger.info('Auto-calculating winnings for completed tournament', {
        tournamentId: id,
        tournamentName: tournament.name,
      });

      winningsResult = await calculateTournamentWinnings(supabase, id);

      if (winningsResult.success) {
        logger.info('Winnings calculated successfully', {
          tournamentId: id,
          playersUpdated: winningsResult.playersUpdated,
          totalPurse: winningsResult.totalPurse,
        });
      } else {
        logger.warn('Failed to calculate winnings (tournament still marked completed)', {
          tournamentId: id,
          error: winningsResult.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      tournament,
      message: `Tournament status updated to "${status}"`,
      sync: syncResult ? {
        success: syncResult.success,
        message: syncResult.message,
        playersUpdated: syncResult.playersUpdated,
      } : undefined,
      winnings: winningsResult ? {
        calculated: winningsResult.success,
        message: winningsResult.message,
        totalPurse: winningsResult.totalPurse,
        playersUpdated: winningsResult.playersUpdated,
      } : undefined,
    });
  } catch (error: unknown) {
    logger.error('Unexpected error updating tournament status', {}, error as Error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update tournament status' },
      { status: 500 }
    );
  }
}