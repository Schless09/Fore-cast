import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/logger';

/**
 * List all tournaments
 * GET /api/admin/tournaments
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      logger.error('Failed to fetch tournaments', {
        errorMessage: error.message,
        errorCode: error.code,
      }, error as Error);
      return NextResponse.json(
        { error: `Failed to fetch tournaments: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tournaments,
    });
  } catch (error: unknown) {
    logger.error('Unexpected error fetching tournaments', {}, error as Error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tournaments' },
      { status: 500 }
    );
  }
}

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
 * Body: { name, course?, start_date, end_date, status?, rapidapi_tourn_id? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { name, course, start_date, end_date, status = 'upcoming', rapidapi_tourn_id } = body;

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
        rapidapi_tourn_id: rapidapi_tourn_id || null,
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
 * Body: { tournaments: [{ name, course?, start_date, end_date, status?, rapidapi_tourn_id? }] }
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

    const createdTournaments = [];
    let skippedCount = 0;

    // Process each tournament individually to handle duplicates properly
    for (const tournament of tournaments) {
      // Check if tournament already exists by rapidapi_tourn_id or name + start_date
      let existingQuery = supabase.from('tournaments').select('id');

      if (tournament.rapidapi_tourn_id) {
        existingQuery = existingQuery.eq('rapidapi_tourn_id', tournament.rapidapi_tourn_id);
      } else {
        existingQuery = existingQuery.eq('name', tournament.name).eq('start_date', tournament.start_date);
      }

      const { data: existing } = await existingQuery.limit(1);

      if (existing && existing.length > 0) {
        // Tournament already exists, skip it
        skippedCount++;
        continue;
      }

      // Create new tournament
      const { data: newTournament, error: createError } = await supabase
        .from('tournaments')
        .insert({
          name: tournament.name,
          course: tournament.course || null,
          start_date: tournament.start_date,
          end_date: tournament.end_date,
          status: tournament.status || 'upcoming',
          current_round: 1,
          rapidapi_tourn_id: tournament.rapidapi_tourn_id || null,
        })
        .select()
        .single();

      if (createError) {
        logger.error('Failed to create tournament', {
          errorMessage: createError.message,
          tournamentName: tournament.name,
        }, createError as Error);
        // Continue with other tournaments instead of failing completely
        continue;
      }

      createdTournaments.push(newTournament);
    }

    logger.info('Bulk tournaments processed successfully', {
      created: createdTournaments.length,
      skipped: skippedCount,
      total: tournaments.length,
    });

    return NextResponse.json({
      success: true,
      count: createdTournaments.length,
      skipped: skippedCount,
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
