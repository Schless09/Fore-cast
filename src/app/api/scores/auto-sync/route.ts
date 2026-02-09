import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { shouldPollNow } from '@/lib/polling-config';
import { syncTournamentScores } from '@/lib/sync-scores';
import { calculateTournamentWinnings } from '@/lib/calculate-winnings';

/**
 * Smart Auto-sync endpoint for Vercel Cron
 * 
 * Features:
 * - Only polls during tournament hours (Thu-Sun)
 * - Uses RapidAPI (Live Golf Data) instead of LiveGolfAPI
 * - Stores results in Supabase cache for all users
 * - Logs API calls for monitoring rate limits
 * - Auto-syncs R1/R2 tee times for upcoming tournaments (1-2 days before)
 * - Auto-writes current round tee times from leaderboard data
 * 
 * Cron runs every 4 minutes, but we check shouldPollNow() to determine
 * if we actually make an API call based on tournament schedule.
 */

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

// Fuzzy name normalization for matching API names to DB names
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .replace(/ø/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/é/g, 'e')
    .replace(/á/g, 'a')
    .replace(/í/g, 'i')
    .replace(/å/g, 'a')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Sync R1/R2 tee times from RapidAPI tournament endpoint for upcoming tournaments.
 * Called automatically when a tournament is 1-2 days away and tee times haven't been set.
 */
async function syncPreTournamentTeeTimes(
  supabase: ReturnType<typeof createServiceClient>,
  tournament: { id: string; name: string; rapidapi_tourn_id: string; start_date: string }
): Promise<{ success: boolean; message: string }> {
  const year = new Date(tournament.start_date).getFullYear().toString();
  const tournId = tournament.rapidapi_tourn_id;

  try {
    console.log(`[AUTO-SYNC] 📋 Fetching R1/R2 tee times for ${tournament.name}...`);

    const response = await fetch(
      `https://${RAPIDAPI_HOST}/tournament?year=${year}&tournId=${tournId}&orgId=1`,
      {
        headers: {
          'X-RapidAPI-Host': RAPIDAPI_HOST,
          'X-RapidAPI-Key': RAPIDAPI_KEY,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return { success: false, message: `RapidAPI tournament endpoint returned ${response.status}` };
    }

    const json = await response.json();
    const players = json.players || [];

    // Populate course info from tournament API if missing
    const courses = json.courses || [];
    if (courses.length > 0) {
      const hostCourse = courses.find((c: Record<string, unknown>) => c.host === 'Yes') || courses[0];
      const location = hostCourse.location as Record<string, string> | undefined;
      const courseName = hostCourse.courseName as string | undefined;
      const parTotal = hostCourse.parTotal ? parseInt(String(hostCourse.parTotal), 10) : null;
      const city = location?.city;
      const state = location?.state;
      const country = location?.country;

      // Build location string: "City, State" for USA, "City, Country" for international
      let courseLocation: string | null = null;
      if (city) {
        if (country === 'USA' && state) {
          courseLocation = `${city}, ${state}`;
        } else if (country && country !== 'USA') {
          // Map country codes to names for international courses
          const countryNames: Record<string, string> = { SCO: 'Scotland', ENG: 'England', CAN: 'Canada', AUS: 'Australia', JPN: 'Japan' };
          courseLocation = `${city}, ${countryNames[country] || country}`;
        } else if (state) {
          courseLocation = `${city}, ${state}`;
        } else {
          courseLocation = city;
        }
      }

      const courseUpdate: Record<string, string | number | null> = {};
      if (courseName) courseUpdate.course = courseName;
      if (courseLocation) courseUpdate.course_location = courseLocation;
      if (parTotal) courseUpdate.course_par = parTotal;

      if (Object.keys(courseUpdate).length > 0) {
        await supabase
          .from('tournaments')
          .update(courseUpdate)
          .eq('id', tournament.id)
          .is('course', null); // Only update if course not already set
        console.log(`[AUTO-SYNC] 📍 Updated course info for ${tournament.name}: ${courseName || 'N/A'}`);
      }
    }

    if (players.length === 0) {
      return { success: false, message: 'No players in tournament data' };
    }

    // Get tournament_players with their pga_player names for matching
    const { data: tournamentPlayers, error: tpError } = await supabase
      .from('tournament_players')
      .select('id, pga_player_id, pga_players(name)')
      .eq('tournament_id', tournament.id);

    if (tpError || !tournamentPlayers) {
      return { success: false, message: `Failed to fetch tournament players: ${tpError?.message}` };
    }

    // Build a map of normalized name -> tournament_player ID
    const nameToIdMap = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tournamentPlayers.forEach((tp: any) => {
      const pgaPlayer = Array.isArray(tp.pga_players) ? tp.pga_players[0] : tp.pga_players;
      const playerName = pgaPlayer?.name;
      if (playerName) {
        nameToIdMap.set(normalizeName(playerName), tp.id);
      }
    });

    let matchedCount = 0;
    const unmatchedNames: string[] = [];

    for (const apiPlayer of players) {
      const fullName = `${apiPlayer.firstName} ${apiPlayer.lastName}`;
      const normalizedApiName = normalizeName(fullName);

      // Try exact match, then last name match
      let tpId = nameToIdMap.get(normalizedApiName);

      if (!tpId) {
        // Try matching by last name only (handles first name variations)
        const apiLast = normalizeName(apiPlayer.lastName);
        const apiFirst = normalizeName(apiPlayer.firstName);
        for (const [dbName, id] of nameToIdMap.entries()) {
          const dbParts = dbName.split(' ');
          const dbLast = dbParts[dbParts.length - 1];
          const dbFirst = dbParts[0];
          if (dbLast === apiLast && (dbFirst === apiFirst || dbFirst.startsWith(apiFirst) || apiFirst.startsWith(dbFirst))) {
            tpId = id;
            break;
          }
        }
      }

      if (!tpId) {
        unmatchedNames.push(fullName);
        continue;
      }

      const teeTimes = apiPlayer.teeTimes || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r1 = teeTimes.find((t: any) => (t.roundId?.$numberInt || t.roundId) === 1 || (t.roundId?.$numberInt || t.roundId) === '1');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r2 = teeTimes.find((t: any) => (t.roundId?.$numberInt || t.roundId) === 2 || (t.roundId?.$numberInt || t.roundId) === '2');

      const updateData: Record<string, string | number | null> = {};

      if (r1?.teeTime) {
        updateData.tee_time_r1 = r1.teeTime;
        updateData.starting_tee_r1 = r1.startingHole || 1;
      }
      if (r2?.teeTime) {
        updateData.tee_time_r2 = r2.teeTime;
        updateData.starting_tee_r2 = r2.startingHole || 1;
      }

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('tournament_players')
          .update(updateData)
          .eq('id', tpId);

        if (!error) matchedCount++;
      }
    }

    const msg = `Synced R1/R2 tee times: ${matchedCount}/${players.length} matched`;
    if (unmatchedNames.length > 0) {
      console.log(`[AUTO-SYNC] Unmatched players: ${unmatchedNames.join(', ')}`);
    }
    console.log(`[AUTO-SYNC] ${msg}`);
    return { success: true, message: msg };

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AUTO-SYNC] Error syncing tee times for ${tournament.name}:`, msg);
    return { success: false, message: msg };
  }
}

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
    
    console.log(`[AUTO-SYNC] ${now.toISOString()}`);
    console.log(`[AUTO-SYNC] Should poll: ${pollStatus.shouldPoll} - ${pollStatus.reason}`);

    // Auto-activate upcoming tournaments that have started
    // Also auto-sync R1/R2 tee times for tournaments starting within 2 days
    const { data: upcomingTournaments } = await supabase
      .from('tournaments')
      .select('id, name, start_date, rapidapi_tourn_id')
      .eq('status', 'upcoming');

    if (upcomingTournaments && upcomingTournaments.length > 0) {
      for (const tournament of upcomingTournaments) {
        const startDate = new Date(tournament.start_date + 'T00:00:00-05:00'); // EST
        const daysUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

        // Auto-sync R1/R2 tee times if tournament starts within 2 days and has a RapidAPI ID
        if (daysUntilStart <= 2 && daysUntilStart > -1 && tournament.rapidapi_tourn_id) {
          // Check if R1 tee times already exist (non-null and non-"-")
          const { data: existingTeeTimes } = await supabase
            .from('tournament_players')
            .select('tee_time_r1')
            .eq('tournament_id', tournament.id)
            .not('tee_time_r1', 'is', null)
            .neq('tee_time_r1', '-')
            .limit(1);

          const hasTeeTimes = existingTeeTimes && existingTeeTimes.length > 0;

          if (!hasTeeTimes) {
            console.log(`[AUTO-SYNC] 📋 ${tournament.name} starts in ${daysUntilStart.toFixed(1)} days, syncing tee times...`);
            await syncPreTournamentTeeTimes(supabase, tournament);
          }
        }

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
      .select('id, name, rapidapi_tourn_id, start_date, end_date, current_round')
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

    // Allow force bypass with ?force=true for manual triggering
    const forceSync = request.nextUrl.searchParams.get('force') === 'true';
    
    // If we shouldn't poll now, just return status (unless forced)
    if (!pollStatus.shouldPoll && !forceSync) {
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

          // When round advances, write tee times from leaderboard data to DB
          // This handles R3/R4 tee times automatically (and refreshes R1/R2 if needed)
          if (roundId >= 1 && roundId <= 4) {
            const teeTimeColumn = `tee_time_r${roundId}`;
            const startingTeeColumn = `starting_tee_r${roundId}`;

            // Get tournament_players for matching
            const { data: tpData } = await supabase
              .from('tournament_players')
              .select('id, pga_player_id, pga_players(name)')
              .eq('tournament_id', tournament.id);

            if (tpData && tpData.length > 0) {
              // Build name -> id map
              const nameMap = new Map<string, string>();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tpData.forEach((tp: any) => {
                const pgaPlayer = Array.isArray(tp.pga_players) ? tp.pga_players[0] : tp.pga_players;
                if (pgaPlayer?.name) {
                  nameMap.set(normalizeName(pgaPlayer.name), tp.id);
                }
              });

              let teeTimeUpdates = 0;
              for (const playerData of transformedData) {
                if (!playerData.teeTime) continue;

                const normalizedApiName = normalizeName(playerData.player);
                let tpId = nameMap.get(normalizedApiName);

                // Fuzzy match by last name + first name prefix
                if (!tpId) {
                  const apiParts = normalizedApiName.split(' ');
                  const apiFirst = apiParts[0];
                  const apiLast = apiParts[apiParts.length - 1];
                  for (const [dbName, id] of nameMap.entries()) {
                    const dbParts = dbName.split(' ');
                    const dbLast = dbParts[dbParts.length - 1];
                    const dbFirst = dbParts[0];
                    if (dbLast === apiLast && (dbFirst === apiFirst || dbFirst.startsWith(apiFirst) || apiFirst.startsWith(dbFirst))) {
                      tpId = id;
                      break;
                    }
                  }
                }

                if (tpId) {
                  await supabase
                    .from('tournament_players')
                    .update({ [teeTimeColumn]: playerData.teeTime, [startingTeeColumn]: 1 })
                    .eq('id', tpId);
                  teeTimeUpdates++;
                }
              }

              if (teeTimeUpdates > 0) {
                console.log(`[AUTO-SYNC] 📋 Wrote ${teeTimeUpdates} R${roundId} tee times to DB for ${tournament.name}`);
              }
            }
          }
        }

        // Auto-update tournament status if completed, then finalize scores & winnings
        if (status === 'Official') {
          await supabase
            .from('tournaments')
            .update({ status: 'completed' })
            .eq('id', tournament.id)
            .eq('status', 'active');
          console.log(`[AUTO-SYNC] ✅ Marked ${tournament.name} as completed`);

          // Sync final scores/positions from cache
          if (tournament.rapidapi_tourn_id) {
            const syncResult = await syncTournamentScores(supabase, tournament.id, tournament.rapidapi_tourn_id);
            if (syncResult.success) {
              console.log(`[AUTO-SYNC] ✅ Synced final scores for ${tournament.name} (${syncResult.playersUpdated} players)`);
            } else {
              console.error(`[AUTO-SYNC] ⚠️ Failed to sync scores for ${tournament.name}: ${syncResult.message}`);
            }
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
