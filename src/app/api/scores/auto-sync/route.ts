import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { shouldPollNow } from '@/lib/polling-config';
import { syncTournamentScores, syncTournamentScoresFromESPN } from '@/lib/sync-scores';
import { calculateTournamentWinnings } from '@/lib/calculate-winnings';

/**
 * Smart Auto-sync endpoint for Vercel Cron
 *
 * Features:
 * - RapidAPI limited to once per 24 hours (leaderboard, official wrap-up, event transitions)
 * - ESPN cache (espn-sync) used for live score reporting throughout tournament
 * - Tee times: CBS only, via check-withdrawals cron (Tue–Thu). No RapidAPI for tee times.
 * - Auto-activates upcoming tournaments when first tee time passes
 *
 * Cron runs every 4 minutes; shouldPollNow() and 24h throttle gate RapidAPI calls.
 */

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authorize: Vercel Cron (Bearer CRON_SECRET) or signed-in user (e.g. admin Force Sync)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const { userId } = await auth();

    const isDev = process.env.NODE_ENV === 'development';
    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isUserAuth = !!userId;
    const isAuthorized = !cronSecret || isCronAuth || isDev || isUserAuth;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const now = new Date();
    
    // Check if we should poll based on tournament schedule
    const pollStatus = shouldPollNow(now);
    
    const forceSync = request.nextUrl.searchParams.get('force') === 'true';
    const rapidApiDaily = request.nextUrl.searchParams.get('source') === 'rapidapi-daily';
    // Only run RapidAPI when triggered by rapidapi-daily cron or admin Force Sync
    const runRapidApi = forceSync || rapidApiDaily;

    console.log(`[AUTO-SYNC] ${now.toISOString()}`);
    console.log(`[AUTO-SYNC] Run RapidAPI: ${runRapidApi} (force=${forceSync}, rapidapi-daily=${rapidApiDaily})`);

    // Auto-activate upcoming tournaments when first tee time passes (tee times from CBS via check-withdrawals)
    const { data: upcomingTournaments } = await supabase
      .from('tournaments')
      .select('id, name, start_date')
      .eq('status', 'upcoming');

    if (upcomingTournaments && upcomingTournaments.length > 0) {
      for (const tournament of upcomingTournaments) {
        // Get earliest tee time for this tournament to determine activation time
        const { data: teeTimeData } = await supabase
          .from('tournament_players')
          .select('tee_time_r1')
          .eq('tournament_id', tournament.id)
          .not('tee_time_r1', 'is', null)
          .neq('tee_time_r1', '-')
          .limit(200);

        // Parse and find earliest tee time (default to 7:00 AM if none set)
        let earliestHour = 7;
        let earliestMinute = 0;

        if (teeTimeData && teeTimeData.length > 0) {
          const parseTime = (timeStr: string): number => {
            const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (!match) return 9999;
            let hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const period = match[3].toUpperCase();
            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            return hours * 60 + minutes;
          };

          const teeTimes = teeTimeData
            .map((t: { tee_time_r1: string | null }) => t.tee_time_r1)
            .filter((t): t is string => t !== null && t !== '-');

          if (teeTimes.length > 0) {
            const sorted = teeTimes.sort((a, b) => parseTime(a) - parseTime(b));
            const earliest = sorted[0];
            const match = earliest.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (match) {
              earliestHour = parseInt(match[1], 10);
              earliestMinute = parseInt(match[2], 10);
              const period = match[3].toUpperCase();
              if (period === 'PM' && earliestHour !== 12) earliestHour += 12;
              if (period === 'AM' && earliestHour === 12) earliestHour = 0;
            }
          }
        }

        // Create target datetime in EST
        const [year, month, day] = tournament.start_date.split('-').map(Number);
        const estTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(earliestHour).padStart(2, '0')}:${String(earliestMinute).padStart(2, '0')}:00-05:00`;
        const tournamentStartTime = new Date(estTimeString);

        // If current time is past the start time, activate the tournament
        if (now >= tournamentStartTime) {
          const { error: updateError } = await supabase
            .from('tournaments')
            .update({ status: 'active' })
            .eq('id', tournament.id);

          if (!updateError) {
            console.log(`[AUTO-SYNC] 🟢 Activated tournament: ${tournament.name}`);
          } else {
            console.error(`[AUTO-SYNC] Failed to activate ${tournament.name}:`, updateError);
          }
        }
      }
    }

    // Get all active tournaments
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, rapidapi_tourn_id, espn_event_id, start_date, end_date, current_round')
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

    // Skip RapidAPI unless triggered by rapidapi-daily or Force Sync (ESPN handles live scores)
    if (!runRapidApi) {
      return NextResponse.json({
        success: true,
        message: 'Activation only. RapidAPI runs via rapidapi-daily cron (once/day). ESPN for live scores.',
        pollingStatus: pollStatus,
        activeTournaments: tournaments.length,
        timestamp: now.toISOString(),
      });
    }

    // Time to poll RapidAPI — fetch and cache scores for each active tournament
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
        // Handle MongoDB extended JSON format and ensure roundId is always a number
        const rawRoundId = json.roundId?.$numberInt || json.roundId || 1;
        const roundId = typeof rawRoundId === 'string' ? parseInt(rawRoundId, 10) : rawRoundId;
        const status = json.status || 'Unknown';
        
        // Transform to our format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformedData = leaderboard.map((player: Record<string, any>) => {
          const position = player.position;
          const positionNum = parseInt(position?.replace('T', '')) || null;
          
          return {
            player: `${player.firstName} ${player.lastName}`,
            playerId: player.playerId,
            position: position,
            positionValue: positionNum,
            total: player.total,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rounds: player.rounds?.map((r: Record<string, any>) => ({
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
            isAmateur: player.isAmateur === true,
          };
        });

        // Extract cut line info - handle MongoDB extended JSON format
        const cutLine = json.cutLines?.[0] || null;
        
        // Helper to extract number from potential {$numberInt: "value"} format
        const extractNumber = (val: unknown): number | null => {
          if (typeof val === 'object' && val !== null && '$numberInt' in val) {
            return parseInt((val as { $numberInt: string }).$numberInt, 10);
          }
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return parseInt(val, 10) || null;
          return null;
        };

        const cacheData = {
          data: transformedData,
          source: 'rapidapi',
          timestamp: Date.now(),
          tournamentStatus: status,
          currentRound: roundId,
          lastUpdated: json.lastUpdated,
          cutLine: cutLine ? {
            cutScore: cutLine.cutScore,
            cutCount: extractNumber(cutLine.cutCount) || cutLine.cutCount,
          } : null,
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

        // Auto-update tournament current_round
        if (roundId && roundId !== tournament.current_round) {
          await supabase
            .from('tournaments')
            .update({ current_round: roundId })
            .eq('id', tournament.id);
          console.log(`[AUTO-SYNC] 📍 Updated ${tournament.name} to Round ${roundId}`);
        }

        // Auto-update tournament status if completed, then finalize scores & winnings.
        // Guard: only mark complete when round 4+ (RapidAPI can return "Official" after R3)
        if (status === 'Official' && roundId >= 4) {
          await supabase
            .from('tournaments')
            .update({ status: 'completed' })
            .eq('id', tournament.id)
            .eq('status', 'active');
          console.log(`[AUTO-SYNC] ✅ Marked ${tournament.name} as completed`);

          // Sync final scores/positions (ESPN preferred, fallback to RapidAPI)
          let syncResult = null;
          if (tournament.espn_event_id) {
            syncResult = await syncTournamentScoresFromESPN(supabase, tournament.id);
          }
          if (!syncResult?.success && tournament.rapidapi_tourn_id) {
            syncResult = await syncTournamentScores(supabase, tournament.id, tournament.rapidapi_tourn_id);
          }
          if (syncResult?.success) {
            console.log(`[AUTO-SYNC] ✅ Synced final scores for ${tournament.name} from ${syncResult.source} (${syncResult.playersUpdated} players)`);
          } else if (tournament.espn_event_id || tournament.rapidapi_tourn_id) {
            console.error(`[AUTO-SYNC] ⚠️ Failed to sync scores for ${tournament.name}: ${syncResult?.message}`);
          }

          // Calculate and save winnings
          const winningsResult = await calculateTournamentWinnings(supabase, tournament.id);
          if (winningsResult.success) {
            console.log(`[AUTO-SYNC] ✅ Calculated winnings for ${tournament.name} (${winningsResult.playersUpdated} players, purse: ${winningsResult.totalPurse})`);
          } else {
            console.error(`[AUTO-SYNC] ⚠️ Failed to calculate winnings for ${tournament.name}: ${winningsResult.message}`);
          }
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

  } catch (error: unknown) {
    console.error('[AUTO-SYNC] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to auto-sync' },
      { status: 500 }
    );
  }
}

// Support POST for manual triggering (useful for testing)
export async function POST(request: NextRequest) {
  return GET(request);
}
