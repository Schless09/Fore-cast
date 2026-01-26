import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { shouldPollNow, getPollingDebugInfo } from '@/lib/polling-config';

/**
 * Smart Auto-sync endpoint for Vercel Cron
 * 
 * Features:
 * - Only polls during tournament hours (Thu-Sun)
 * - Uses RapidAPI (Live Golf Data) instead of LiveGolfAPI
 * - Stores results in Supabase cache for all users
 * - Logs API calls for monitoring rate limits
 * 
 * Cron runs every 3 minutes, but we check shouldPollNow() to determine
 * if we actually make an API call based on tournament schedule.
 */

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

// No more mapping needed - rapidapi_tourn_id now stores the RapidAPI tournId directly (e.g., "002", "004")

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify the request is from Vercel Cron (in production)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Allow bypass in development or if no secret configured
    const isDev = process.env.NODE_ENV === 'development';
    const isAuthorized = !cronSecret || authHeader === `Bearer ${cronSecret}` || isDev;
    
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const now = new Date();
    
    // Check if we should poll based on tournament schedule
    const pollStatus = shouldPollNow(now);
    
    console.log(`[AUTO-SYNC] ${now.toISOString()}`);
    console.log(`[AUTO-SYNC] Should poll: ${pollStatus.shouldPoll} - ${pollStatus.reason}`);

    // Get all active tournaments
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, rapidapi_tourn_id, start_date, end_date')
      .eq('status', 'active')
      .not('rapidapi_tourn_id', 'is', null);

    if (tournamentsError) {
      console.error('[AUTO-SYNC] Error fetching tournaments:', tournamentsError);
      return NextResponse.json(
        { error: 'Failed to fetch tournaments' },
        { status: 500 }
      );
    }

    if (!tournaments || tournaments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active tournaments to sync',
        pollingStatus: pollStatus,
        timestamp: now.toISOString(),
      });
    }

    // If we shouldn't poll now, just return status
    if (!pollStatus.shouldPoll) {
      return NextResponse.json({
        success: true,
        message: `Skipping sync: ${pollStatus.reason}`,
        pollingStatus: pollStatus,
        activeTournaments: tournaments.length,
        nextPollIn: `${pollStatus.nextPollMinutes} minutes`,
        timestamp: now.toISOString(),
      });
    }

    // Time to poll! Fetch and cache scores for each active tournament
    const results = [];
    
    for (const tournament of tournaments) {
      // rapidapi_tourn_id now stores the RapidAPI tournId directly (e.g., "002", "004")
      const tournId = tournament.rapidapi_tourn_id;
      
      if (!tournId) {
        console.warn(`[AUTO-SYNC] No RapidAPI tournId for: ${tournament.name}`);
        results.push({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          success: false,
          error: 'No RapidAPI tournId configured',
        });
        continue;
      }

      try {
        // Derive year from tournament start date
        const year = new Date(tournament.start_date).getFullYear().toString();
        const cacheKey = `${year}-${tournId}`;
        
        console.log(`[AUTO-SYNC] Fetching ${tournament.name} (${cacheKey})...`);
        
        const fetchStart = Date.now();
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
        const fetchDuration = Date.now() - fetchStart;

        // Log the API call
        await supabase.from('api_call_log').insert({
          api_name: 'rapidapi',
          endpoint: '/leaderboard',
          cache_key: cacheKey,
          success: response.ok,
          response_time_ms: fetchDuration,
          error_message: response.ok ? null : `HTTP ${response.status}`,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          console.error(`[AUTO-SYNC] RapidAPI error: ${response.status} - ${errorText}`);
          results.push({
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            success: false,
            error: `RapidAPI error (${response.status})`,
          });
          continue;
        }

        const json = await response.json();
        
        // Transform and prepare data
        const leaderboard = json.leaderboardRows || [];
        const roundId = json.roundId?.$numberInt || json.roundId || 1;
        const status = json.status || 'Unknown';
        
        // Transform to our format
        const transformedData = leaderboard.map((player: any) => {
          const position = player.position;
          const positionNum = parseInt(position?.replace('T', '')) || null;
          
          return {
            player: `${player.firstName} ${player.lastName}`,
            playerId: player.playerId,
            position: position,
            positionValue: positionNum,
            total: player.total,
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

        const cacheData = {
          data: transformedData,
          source: 'rapidapi',
          timestamp: Date.now(),
          tournamentStatus: status,
          currentRound: roundId,
          lastUpdated: json.lastUpdated,
        };

        // Upsert into cache table
        const { error: cacheError } = await supabase
          .from('live_scores_cache')
          .upsert({
            cache_key: cacheKey,
            tournament_id: tournament.id,
            data: cacheData,
            tournament_status: status,
            current_round: roundId,
            player_count: transformedData.length,
          }, {
            onConflict: 'cache_key',
          });

        if (cacheError) {
          console.error(`[AUTO-SYNC] Cache error for ${tournament.name}:`, cacheError);
          results.push({
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            success: false,
            error: 'Failed to cache data',
          });
          continue;
        }

        // Auto-update tournament status if completed
        if (status === 'Official') {
          await supabase
            .from('tournaments')
            .update({ status: 'completed' })
            .eq('id', tournament.id)
            .eq('status', 'active');
          console.log(`[AUTO-SYNC] ✅ Marked ${tournament.name} as completed`);
        }

        console.log(`[AUTO-SYNC] ✅ Cached ${transformedData.length} players for ${tournament.name}`);
        
        results.push({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          success: true,
          playersCount: transformedData.length,
          round: roundId,
          status: status,
          fetchDuration: `${fetchDuration}ms`,
        });

      } catch (error) {
        console.error(`[AUTO-SYNC] Error processing ${tournament.name}:`, error);
        results.push({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Auto-synced ${successCount}/${results.length} tournaments`,
      pollingStatus: pollStatus,
      timestamp: now.toISOString(),
      duration: `${totalDuration}ms`,
      results,
    });

  } catch (error: any) {
    console.error('[AUTO-SYNC] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-sync' },
      { status: 500 }
    );
  }
}

// Support POST for manual triggering (useful for testing)
export async function POST(request: NextRequest) {
  return GET(request);
}
