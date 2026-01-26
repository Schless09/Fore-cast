import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Sync player rankings from RapidAPI
 * Called by Vercel cron: Every Monday at 11am CST (17:00 UTC)
 * 
 * Updates:
 * - world_ranking from statId=186
 * - fedex_cup_ranking from statId=02671
 */

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

interface RankingEntry {
  playerId: string;
  firstName: string;
  lastName: string;
  rank: number | string | { $numberInt: string };
}

// Helper to extract numeric rank from various formats
function parseRank(rank: number | string | { $numberInt: string } | undefined): number | null {
  if (rank === undefined || rank === null) return null;
  
  // Handle MongoDB-style object: {"$numberInt":"26"}
  if (typeof rank === 'object' && '$numberInt' in rank) {
    return parseInt(rank.$numberInt, 10);
  }
  
  // Handle string
  if (typeof rank === 'string') {
    const parsed = parseInt(rank, 10);
    return isNaN(parsed) ? null : parsed;
  }
  
  // Handle number
  if (typeof rank === 'number') {
    return rank;
  }
  
  return null;
}

interface StatsResponse {
  rankings: RankingEntry[];
}

async function fetchRankings(statId: string, year: string): Promise<RankingEntry[]> {
  const response = await fetch(
    `https://${RAPIDAPI_HOST}/stats?year=${year}&statId=${statId}`,
    {
      headers: {
        'X-RapidAPI-Host': RAPIDAPI_HOST,
        'X-RapidAPI-Key': RAPIDAPI_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`RapidAPI error: ${response.status} ${response.statusText}`);
  }

  const data: StatsResponse = await response.json();
  return data.rankings || [];
}

function normalizePlayerName(firstName: string, lastName: string): string {
  // Create full name for matching
  return `${firstName} ${lastName}`.trim().toLowerCase();
}

/**
 * Import all players from world rankings
 * POST /api/cron/sync-rankings
 * 
 * This will:
 * 1. Delete all existing pga_players (cascades to tournament_players, roster_players)
 * 2. Import all players from world rankings
 * 3. Set their world_ranking
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const year = new Date().getFullYear().toString();
  
  console.log(`[IMPORT-PLAYERS] Starting fresh import for year ${year}`);

  try {
    const supabase = createServiceClient();

    // Fetch World Rankings (has all 1000+ players)
    console.log('[IMPORT-PLAYERS] Fetching World Rankings...');
    const worldRankings = await fetchRankings('186', year);
    console.log(`[IMPORT-PLAYERS] Received ${worldRankings.length} players`);

    if (worldRankings.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No players received from API',
      }, { status: 500 });
    }

    // Delete all existing players (cascades to tournament_players, roster_players, etc.)
    console.log('[IMPORT-PLAYERS] Deleting existing players...');
    const { error: deleteError } = await supabase
      .from('pga_players')
      .delete()
      .gte('created_at', '1970-01-01'); // Match all

    if (deleteError) {
      console.error('[IMPORT-PLAYERS] Delete error:', deleteError);
      return NextResponse.json({
        success: false,
        error: `Failed to delete existing players: ${deleteError.message}`,
      }, { status: 500 });
    }

    // Insert all players from world rankings
    console.log('[IMPORT-PLAYERS] Inserting new players...');
    const playersToInsert = worldRankings.map(entry => {
      const rank = parseRank(entry.rank);
      return {
        name: `${entry.firstName} ${entry.lastName}`.trim(),
        world_ranking: rank,
        is_active: true,
      };
    });

    // Insert in batches of 100 to avoid timeouts
    let insertedCount = 0;
    let errorCount = 0;
    const batchSize = 100;

    for (let i = 0; i < playersToInsert.length; i += batchSize) {
      const batch = playersToInsert.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('pga_players')
        .insert(batch);

      if (insertError) {
        console.error(`[IMPORT-PLAYERS] Batch insert error:`, insertError);
        errorCount += batch.length;
      } else {
        insertedCount += batch.length;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[IMPORT-PLAYERS] ✅ Complete: ${insertedCount} inserted, ${errorCount} errors in ${duration}ms`);

    // Now sync FedEx rankings for these players
    console.log('[IMPORT-PLAYERS] Syncing FedEx Cup rankings...');
    const fedexRankings = await fetchRankings('02671', year);
    
    // Get all players we just inserted
    const { data: players } = await supabase
      .from('pga_players')
      .select('id, name');

    const playerMap = new Map<string, string>();
    players?.forEach(p => playerMap.set(p.name.toLowerCase(), p.id));

    let fedexUpdated = 0;
    for (const entry of fedexRankings) {
      const name = `${entry.firstName} ${entry.lastName}`.trim().toLowerCase();
      const playerId = playerMap.get(name);
      const rank = parseRank(entry.rank);
      
      if (playerId && rank !== null) {
        await supabase
          .from('pga_players')
          .update({ fedex_cup_ranking: rank })
          .eq('id', playerId);
        fedexUpdated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Players imported successfully',
      stats: {
        playersImported: insertedCount,
        fedexRankingsApplied: fedexUpdated,
        errors: errorCount,
        durationMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[IMPORT-PLAYERS] ❌ Error:', errorMessage);
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret for security (optional but recommended)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow manual trigger without auth in development
    const isManual = request.nextUrl.searchParams.get('manual') === 'true';
    if (!isManual) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startTime = Date.now();
  const year = new Date().getFullYear().toString();
  
  console.log(`[SYNC-RANKINGS] Starting sync for year ${year}`);

  try {
    const supabase = createServiceClient();

    // Fetch all existing players
    const { data: players, error: playersError } = await supabase
      .from('pga_players')
      .select('id, name');

    if (playersError) throw playersError;

    if (!players || players.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No players found in database',
      });
    }

    // Create a map of normalized names to player IDs
    const playerMap = new Map<string, string>();
    players.forEach(player => {
      playerMap.set(player.name.toLowerCase(), player.id);
    });

    console.log(`[SYNC-RANKINGS] Found ${players.length} players in database`);

    // Fetch World Rankings (statId=186)
    console.log('[SYNC-RANKINGS] Fetching World Rankings...');
    const worldRankings = await fetchRankings('186', year);
    console.log(`[SYNC-RANKINGS] Received ${worldRankings.length} world rankings`);

    // Fetch FedEx Cup Standings (statId=02671)
    console.log('[SYNC-RANKINGS] Fetching FedEx Cup Standings...');
    const fedexRankings = await fetchRankings('02671', year);
    console.log(`[SYNC-RANKINGS] Received ${fedexRankings.length} FedEx rankings`);

    // Build update map
    const updates = new Map<string, { world_ranking?: number; fedex_cup_ranking?: number }>();

    // Process World Rankings
    let worldMatched = 0;
    for (const entry of worldRankings) {
      const normalizedName = normalizePlayerName(entry.firstName, entry.lastName);
      const playerId = playerMap.get(normalizedName);
      const rank = parseRank(entry.rank);
      
      if (playerId && rank !== null) {
        const existing = updates.get(playerId) || {};
        updates.set(playerId, { ...existing, world_ranking: rank });
        worldMatched++;
      }
    }

    // Process FedEx Cup Rankings
    let fedexMatched = 0;
    for (const entry of fedexRankings) {
      const normalizedName = normalizePlayerName(entry.firstName, entry.lastName);
      const playerId = playerMap.get(normalizedName);
      const rank = parseRank(entry.rank);
      
      if (playerId && rank !== null) {
        const existing = updates.get(playerId) || {};
        updates.set(playerId, { ...existing, fedex_cup_ranking: rank });
        fedexMatched++;
      }
    }

    console.log(`[SYNC-RANKINGS] Matched: ${worldMatched} world, ${fedexMatched} FedEx`);

    // Apply updates
    let updatedCount = 0;
    let errorCount = 0;

    for (const [playerId, rankingData] of updates) {
      const { error: updateError } = await supabase
        .from('pga_players')
        .update(rankingData)
        .eq('id', playerId);

      if (updateError) {
        console.error(`[SYNC-RANKINGS] Error updating player ${playerId}:`, updateError);
        errorCount++;
      } else {
        updatedCount++;
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[SYNC-RANKINGS] ✅ Complete: ${updatedCount} updated, ${errorCount} errors in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: `Rankings synced successfully`,
      stats: {
        totalPlayers: players.length,
        worldRankingsReceived: worldRankings.length,
        fedexRankingsReceived: fedexRankings.length,
        worldMatched,
        fedexMatched,
        playersUpdated: updatedCount,
        errors: errorCount,
        durationMs: duration,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SYNC-RANKINGS] ❌ Error:', errorMessage);
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
