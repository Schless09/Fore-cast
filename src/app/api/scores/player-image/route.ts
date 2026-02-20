import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * GET /api/scores/player-image?espnPlayerId=10140
 * Returns image_url from pga_players where espn_athlete_id matches.
 * Used by ScorecardModal to show headshot from our DB first (fast) before falling back to ESPN API.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const espnPlayerId = searchParams.get('espnPlayerId');

  if (!espnPlayerId) {
    return NextResponse.json(
      { error: 'Missing espnPlayerId' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('pga_players')
    .select('image_url')
    .eq('espn_athlete_id', espnPlayerId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    image_url: data?.image_url ?? null,
  });
}
