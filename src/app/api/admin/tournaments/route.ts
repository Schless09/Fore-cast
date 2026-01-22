import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/logger';

/**
 * Delete all tournaments
 * DELETE /api/admin/tournaments
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    
    // First, get count of tournaments
    const { count } = await supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true });

    // Delete all tournaments (cascade will handle related records)
    // Using a filter that matches all records
    const { error } = await supabase
      .from('tournaments')
      .delete()
      .gte('created_at', '1970-01-01'); // This will match all records

    if (error) {
      logger.error('Failed to delete tournaments', {
        errorMessage: error.message,
        errorCode: error.code,
      }, error as Error);
      return NextResponse.json(
        { error: `Failed to delete tournaments: ${error.message}` },
        { status: 500 }
      );
    }

    logger.info('All tournaments deleted successfully', {
      deletedCount: count || 0,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${count || 0} tournaments`,
      deletedCount: count || 0,
    });
  } catch (error: any) {
    logger.error('Unexpected error deleting tournaments', {}, error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete tournaments' },
      { status: 500 }
    );
  }
}

/**
 * Create a new tournament
 * POST /api/admin/tournaments
 * Body: { name, course?, start_date, end_date, status?, livegolfapi_event_id? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { name, course, start_date, end_date, status = 'upcoming', livegolfapi_event_id } = body;

    if (!name || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'name, start_date, and end_date are required' },
        { status: 400 }
      );
    }

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        name,
        course: course || null,
        start_date,
        end_date,
        status,
        current_round: 1,
        livegolfapi_event_id: livegolfapi_event_id || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create tournament', {
        errorMessage: error.message,
        errorCode: error.code,
        tournamentName: name,
      }, error as Error);
      return NextResponse.json(
        { error: `Failed to create tournament: ${error.message}` },
        { status: 500 }
      );
    }

    logger.info('Tournament created successfully', {
      tournamentId: tournament.id,
      tournamentName: name,
    });

    return NextResponse.json({
      success: true,
      tournament,
    });
  } catch (error: any) {
    logger.error('Unexpected error creating tournament', {}, error);
    return NextResponse.json(
      { error: error.message || 'Failed to create tournament' },
      { status: 500 }
    );
  }
}

/**
 * Bulk create tournaments
 * POST /api/admin/tournaments/bulk
 * Body: { tournaments: [{ name, course?, start_date, end_date, status?, livegolfapi_event_id? }] }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { tournaments } = body;

    if (!tournaments || !Array.isArray(tournaments)) {
      return NextResponse.json(
        { error: 'tournaments array is required' },
        { status: 400 }
      );
    }

    // Validate all tournaments
    for (const tournament of tournaments) {
      if (!tournament.name || !tournament.start_date || !tournament.end_date) {
        return NextResponse.json(
          { error: 'Each tournament must have name, start_date, and end_date' },
          { status: 400 }
        );
      }
    }

    // Prepare tournament data
    const tournamentData = tournaments.map((t: any) => ({
      name: t.name,
      course: t.course || null,
      start_date: t.start_date,
      end_date: t.end_date,
      status: t.status || 'upcoming',
      current_round: 1,
      livegolfapi_event_id: t.livegolfapi_event_id || null,
    }));

    const { data: createdTournaments, error } = await supabase
      .from('tournaments')
      .insert(tournamentData)
      .select();

    if (error) {
      logger.error('Failed to bulk create tournaments', {
        errorMessage: error.message,
        errorCode: error.code,
        tournamentCount: tournaments.length,
      }, error as Error);
      return NextResponse.json(
        { error: `Failed to create tournaments: ${error.message}` },
        { status: 500 }
      );
    }

    logger.info('Bulk tournaments created successfully', {
      count: createdTournaments?.length || 0,
    });

    return NextResponse.json({
      success: true,
      count: createdTournaments?.length || 0,
      tournaments: createdTournaments,
    });
  } catch (error: any) {
    logger.error('Unexpected error bulk creating tournaments', {}, error);
    return NextResponse.json(
      { error: error.message || 'Failed to create tournaments' },
      { status: 500 }
    );
  }
}
