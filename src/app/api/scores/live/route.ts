import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { CACHE_TTL_MS } from '@/lib/config';

/**
 * Fetch live scores from RapidAPI Live Golf Data
 * Much more reliable than LiveGolfAPI!
 * 
 * Includes in-memory caching to reduce API calls when multiple
 * components request data within a short window.
 * 
 * Auto-updates tournament status to "completed" when API returns "Official"
 */

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '4786f7c55amshbe62b07d4f84965p1a07a0jsn6aef3153473b';

// In-memory cache
interface CacheEntry {
  data: any;
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();

// Tournament ID mapping (RapidAPI uses different IDs)
// You can update this mapping as needed
const TOURNAMENT_ID_MAP: Record<string, { year: string; tournId: string }> = {
  // LiveGolfAPI event ID -> RapidAPI tournId
  '291e61c6-b1e4-49d6-a84e-99864e73a2be': { year: '2026', tournId: '002' }, // The American Express
};

// Helper to update tournament status in database
async function updateTournamentStatusIfCompleted(eventId: string, apiStatus: string) {
  if (apiStatus !== 'Official') return;
  
  try {
    const supabase = createServiceClient();
    
    // Find tournament by livegolfapi_event_id and update status if not already completed
    const { error } = await supabase
      .from('tournaments')
      .update({ status: 'completed' })
      .eq('livegolfapi_event_id', eventId)
      .eq('status', 'active'); // Only update if currently active
    
    if (!error) {
      console.log(`[LiveScores] ✅ Updated tournament status to 'completed' for event ${eventId}`);
    }
  } catch (error) {
    console.error('[LiveScores] Error updating tournament status:', error);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  
  // Allow direct year/tournId params for flexibility
  let year = searchParams.get('year');
  let tournId = searchParams.get('tournId');

  // If eventId provided, try to map it
  if (eventId && TOURNAMENT_ID_MAP[eventId]) {
    year = TOURNAMENT_ID_MAP[eventId].year;
    tournId = TOURNAMENT_ID_MAP[eventId].tournId;
  }

  if (!year || !tournId) {
    return NextResponse.json({ 
      error: 'Missing year and tournId parameters (or unknown eventId)',
      hint: 'Use ?year=2026&tournId=002 or ?eventId=<mapped-id>'
    }, { status: 400 });
  }

  const cacheKey = `${year}-${tournId}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    const cacheAge = Math.round((Date.now() - cached.timestamp) / 1000);
    console.log(`[LiveScores] ✅ Returning cached data (${cacheAge}s old)`);
    return NextResponse.json({
      ...cached.data,
      source: 'cache',
      cacheAge: cacheAge,
    });
  }

  try {
    console.log(`[LiveScores] Fetching fresh data from RapidAPI: year=${year}, tournId=${tournId}`);
    
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/leaderboard?year=${year}&tournId=${tournId}`,
      {
        headers: {
          'X-RapidAPI-Host': RAPIDAPI_HOST,
          'X-RapidAPI-Key': RAPIDAPI_KEY,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[LiveScores] RapidAPI error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `RapidAPI error (${response.status})`, data: null },
        { status: response.status }
      );
    }

    const json = await response.json();
    
    // Transform RapidAPI format to our expected format
    const leaderboard = json.leaderboardRows || [];
    const roundId = json.roundId?.$numberInt || json.roundId || 1;
    const status = json.status || 'Unknown';
    
    console.log(`[LiveScores] ✅ Fetched ${leaderboard.length} players (Round ${roundId}, ${status})`);

    // Auto-update tournament status if completed
    if (eventId && status === 'Official') {
      await updateTournamentStatusIfCompleted(eventId, status);
    }

    // Transform to match our expected format
    const transformedData = leaderboard.map((player: any) => {
      const position = player.position;
      const isTied = position?.startsWith('T') || false;
      const positionNum = parseInt(position?.replace('T', '')) || null;
      
      return {
        player: `${player.firstName} ${player.lastName}`,
        playerId: player.playerId,
        position: position,
        positionValue: positionNum,
        total: player.total, // e.g., "-29"
        rounds: player.rounds?.map((r: any) => ({
          round: r.roundId?.$numberInt || r.roundId,
          score: r.strokes?.$numberInt || r.strokes,
          total: r.scoreToPar,
          thru: player.currentRound === (r.roundId?.$numberInt || r.roundId) ? player.thru : 'F',
        })) || [],
        thru: player.thru,
        currentRound: player.currentRound?.$numberInt || player.currentRound,
        currentRoundScore: player.currentRoundScore,
        teeTime: player.teeTime,
        roundComplete: player.roundComplete,
      };
    });

    const responseData = {
      data: transformedData,
      source: 'rapidapi',
      timestamp: Date.now(),
      tournamentStatus: status,
      currentRound: roundId,
      lastUpdated: json.lastUpdated,
    };

    // Store in cache
    cache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now(),
    });
    console.log(`[LiveScores] 📦 Cached response for ${cacheKey}`);

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('[LiveScores] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch scores', data: null },
      { status: 500 }
    );
  }
}
