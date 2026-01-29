import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';

async function getProfileForClerkUser() {
  const { userId } = await auth();
  
  if (!userId) {
    return { profile: null, error: 'Not authenticated' };
  }

  const user = await currentUser();
  if (!user) {
    return { profile: null, error: 'User not found' };
  }

  const supabase = createServiceClient();
  
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_id', userId)
    .single();

  if (existingProfile) {
    return { profile: existingProfile, error: null };
  }

  return { profile: null, error: 'Profile not found' };
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Fetch league tournament settings and segment definitions
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: leagueId } = await params;
    
    const { profile, error: authError } = await getProfileForClerkUser();
    
    if (authError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Get league info to verify it exists and check if user is commissioner
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name, created_by')
      .eq('id', leagueId)
      .single();

    if (leagueError || !league) {
      return NextResponse.json(
        { success: false, error: 'League not found' },
        { status: 404 }
      );
    }

    const isCommissioner = league.created_by === profile.id;

    // Get all tournaments
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, start_date, end_date, status')
      .order('start_date', { ascending: true });

    if (tournamentsError) {
      console.error('Error fetching tournaments:', tournamentsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch tournaments' },
        { status: 500 }
      );
    }

    // Get league tournament settings (now with segments array)
    const { data: leagueTournaments, error: ltError } = await supabase
      .from('league_tournaments')
      .select('tournament_id, segments, is_excluded')
      .eq('league_id', leagueId);

    if (ltError) {
      console.error('Error fetching league tournaments:', ltError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch league tournament settings' },
        { status: 500 }
      );
    }

    // Get custom segment names
    const { data: segmentDefinitions, error: segError } = await supabase
      .from('league_segments')
      .select('segment_number, name')
      .eq('league_id', leagueId)
      .order('segment_number', { ascending: true });

    if (segError) {
      console.error('Error fetching league segments:', segError);
    }

    // Create a map of tournament settings
    const settingsMap = new Map(
      (leagueTournaments || []).map(lt => [lt.tournament_id, lt])
    );

    // Combine tournaments with their settings
    const tournamentsWithSettings = (tournaments || []).map(t => ({
      ...t,
      segments: settingsMap.get(t.id)?.segments || [],
      is_excluded: settingsMap.get(t.id)?.is_excluded || false,
    }));

    // Get distinct segments used in this league
    const usedSegments = new Set<number>();
    (leagueTournaments || []).forEach(lt => {
      if (!lt.is_excluded && lt.segments) {
        lt.segments.forEach((s: number) => usedSegments.add(s));
      }
    });

    // Build segment definitions with names
    const segments = (segmentDefinitions || []).map(sd => ({
      number: sd.segment_number,
      name: sd.name,
    }));

    // Add any used segments that don't have custom names
    usedSegments.forEach(segNum => {
      if (!segments.find(s => s.number === segNum)) {
        segments.push({ number: segNum, name: `Segment ${segNum}` });
      }
    });

    // Sort by segment number
    segments.sort((a, b) => a.number - b.number);

    return NextResponse.json({
      success: true,
      league: {
        id: league.id,
        name: league.name,
      },
      isCommissioner,
      tournaments: tournamentsWithSettings,
      segments,
    });

  } catch (error) {
    console.error('Unexpected error in GET league tournaments:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// PUT: Update tournament settings for league
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: leagueId } = await params;
    const { tournamentId, segments, isExcluded } = await request.json();

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'Tournament ID is required' },
        { status: 400 }
      );
    }

    const { profile, error: authError } = await getProfileForClerkUser();
    
    if (authError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Verify user is commissioner
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, created_by')
      .eq('id', leagueId)
      .single();

    if (leagueError || !league) {
      return NextResponse.json(
        { success: false, error: 'League not found' },
        { status: 404 }
      );
    }

    if (league.created_by !== profile.id) {
      return NextResponse.json(
        { success: false, error: 'Only the commissioner can modify tournament settings' },
        { status: 403 }
      );
    }

    // If no segments and not excluded, we can delete the entry (default behavior)
    const segmentsArray = segments || [];
    if (segmentsArray.length === 0 && !isExcluded) {
      const { error: deleteError } = await supabase
        .from('league_tournaments')
        .delete()
        .eq('league_id', leagueId)
        .eq('tournament_id', tournamentId);

      if (deleteError) {
        console.error('Error deleting league tournament:', deleteError);
        return NextResponse.json(
          { success: false, error: 'Failed to update tournament settings' },
          { status: 500 }
        );
      }
    } else {
      // Upsert the setting
      const { error: upsertError } = await supabase
        .from('league_tournaments')
        .upsert({
          league_id: leagueId,
          tournament_id: tournamentId,
          segments: segmentsArray,
          is_excluded: isExcluded || false,
        }, {
          onConflict: 'league_id,tournament_id',
        });

      if (upsertError) {
        console.error('Error upserting league tournament:', upsertError);
        return NextResponse.json(
          { success: false, error: 'Failed to update tournament settings' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Unexpected error in PUT league tournaments:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// POST: Create or update a segment definition
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: leagueId } = await params;
    const { segmentNumber, name } = await request.json();

    if (!segmentNumber || !name) {
      return NextResponse.json(
        { success: false, error: 'Segment number and name are required' },
        { status: 400 }
      );
    }

    const { profile, error: authError } = await getProfileForClerkUser();
    
    if (authError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Verify user is commissioner
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, created_by')
      .eq('id', leagueId)
      .single();

    if (leagueError || !league) {
      return NextResponse.json(
        { success: false, error: 'League not found' },
        { status: 404 }
      );
    }

    if (league.created_by !== profile.id) {
      return NextResponse.json(
        { success: false, error: 'Only the commissioner can modify segment names' },
        { status: 403 }
      );
    }

    // Upsert the segment name
    const { error: upsertError } = await supabase
      .from('league_segments')
      .upsert({
        league_id: leagueId,
        segment_number: segmentNumber,
        name: name.trim(),
      }, {
        onConflict: 'league_id,segment_number',
      });

    if (upsertError) {
      console.error('Error upserting league segment:', upsertError);
      return NextResponse.json(
        { success: false, error: 'Failed to update segment name' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Unexpected error in POST league segments:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
