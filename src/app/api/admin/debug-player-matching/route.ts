import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchScoresFromLiveGolfAPI } from '@/lib/livegolfapi';

/**
 * Debug endpoint to show which players aren't matching
 * between database and LiveGolfAPI
 */
export async function POST(request: NextRequest) {
  try {
    const { tournamentId, liveGolfAPITournamentId } = await request.json();

    if (!tournamentId || !liveGolfAPITournamentId) {
      return NextResponse.json(
        { error: 'tournamentId and liveGolfAPITournamentId are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch scores from LiveGolfAPI
    const liveGolfResult = await fetchScoresFromLiveGolfAPI(liveGolfAPITournamentId);

    if (!liveGolfResult.data) {
      return NextResponse.json(
        { error: 'LiveGolfAPI did not return data' },
        { status: 502 }
      );
    }

    const scorecards = liveGolfResult.data;

    // Get all players in our database for this tournament
    const { data: tournamentPlayers } = await supabase
      .from('tournament_players')
      .select('id, pga_player_id, pga_players(name)')
      .eq('tournament_id', tournamentId);

    // Create name maps
    const ourPlayers = new Map<string, string>();
    tournamentPlayers?.forEach((tp: any) => {
      if (tp.pga_players?.name) {
        ourPlayers.set(tp.pga_players.name.toLowerCase().trim(), tp.pga_players.name);
      }
    });

    // Get LiveGolfAPI player names
    const liveGolfPlayers = scorecards.map((sc: any) => sc.player);

    // Find mismatches
    const matched: string[] = [];
    const unmatchedInAPI: string[] = [];
    const unmatchedInDB: string[] = [];

    liveGolfPlayers.forEach((apiName: string) => {
      const normalized = apiName.toLowerCase().trim();
      if (ourPlayers.has(normalized)) {
        matched.push(apiName);
      } else {
        unmatchedInAPI.push(apiName);
      }
    });

    // Find players in DB but not in API
    ourPlayers.forEach((originalName) => {
      const normalized = originalName.toLowerCase().trim();
      const foundInAPI = liveGolfPlayers.some((apiName: string) => 
        apiName.toLowerCase().trim() === normalized
      );
      if (!foundInAPI) {
        unmatchedInDB.push(originalName);
      }
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalInAPI: liveGolfPlayers.length,
        totalInDatabase: ourPlayers.size,
        matched: matched.length,
        unmatchedInAPI: unmatchedInAPI.length,
        unmatchedInDB: unmatchedInDB.length,
      },
      matched: matched.sort(),
      unmatchedInAPI: unmatchedInAPI.sort(),
      unmatchedInDB: unmatchedInDB.sort(),
    });
  } catch (error: any) {
    console.error('Error debugging player matching:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to debug player matching' },
      { status: 500 }
    );
  }
}
