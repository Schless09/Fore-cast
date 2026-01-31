import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Sync R3/R4 tee times using CBS Sports + Gemini AI
 * Called by Vercel cron: Friday and Saturday at midnight CST (06:00 UTC)
 * 
 * After R2 ends (Friday night), this fetches R3 tee times
 * After R3 ends (Saturday night), this fetches R4 tee times
 * 
 * Fetches the CBS Sports leaderboard page and uses Gemini to parse the HTML
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const CBS_SPORTS_URL = 'https://www.cbssports.com/golf/leaderboard/';

interface TeeTimeEntry {
  player: string;
  tee_time: string;
  starting_tee?: number;
}

// Fuzzy name normalization for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\./g, '')
    .replace(/ø/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/é/g, 'e')
    .replace(/á/g, 'a')
    .replace(/í/g, 'i')
    .replace(/\s+/g, ' ');
}

// Common nickname mappings
const nicknameMap: Record<string, string[]> = {
  'zach': ['zachary', 'zack'],
  'zachary': ['zach', 'zack'],
  'john': ['johnny', 'jon'],
  'johnny': ['john', 'jon'],
  'mike': ['michael'],
  'michael': ['mike'],
  'tom': ['thomas', 'tommy'],
  'thomas': ['tom', 'tommy'],
  'dan': ['daniel', 'danny'],
  'daniel': ['dan', 'danny'],
  'matt': ['matthew', 'matti', 'matthias'],
  'matthew': ['matt'],
  'matti': ['matt', 'matthias'],
  'matthias': ['matt', 'matti'],
  'cam': ['cameron'],
  'cameron': ['cam'],
  'nick': ['nicholas', 'nico', 'nicolai'],
  'nicholas': ['nick'],
  'aj': ['a j'],
  'sh': ['s h', 'sung', 'seung'],
};

async function fetchCBSSportsPage(): Promise<{ html: string | null; error?: string }> {
  try {
    console.log('[SYNC-TEE-TIMES] Fetching CBS Sports leaderboard...');
    
    const response = await fetch(CBS_SPORTS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      return { html: null, error: `CBS Sports returned ${response.status}` };
    }
    
    const html = await response.text();
    console.log(`[SYNC-TEE-TIMES] Fetched ${html.length} bytes from CBS Sports`);
    return { html };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SYNC-TEE-TIMES] Error fetching CBS Sports:', errorMsg);
    return { html: null, error: `Fetch error: ${errorMsg}` };
  }
}

async function parseTeeTimesWithGemini(
  html: string,
  round: number
): Promise<{ teeTimes: TeeTimeEntry[] | null; error?: string }> {
  if (!GEMINI_API_KEY) {
    console.error('[SYNC-TEE-TIMES] Missing GEMINI_API_KEY');
    return { teeTimes: null, error: 'Missing GEMINI_API_KEY environment variable' };
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Extract just the leaderboard table portion to reduce token usage
  const tableStart = html.indexOf('<table');
  const tableEnd = html.indexOf('</table>', tableStart);
  const tableHtml = tableStart > -1 && tableEnd > -1 
    ? html.slice(tableStart, tableEnd + 8)
    : html.slice(0, 50000); // Fallback to first 50k chars

  const prompt = `Parse this HTML table from CBS Sports Golf Leaderboard. Extract the Round ${round} tee times for all players who made the cut.

The table has columns: pos, ctry, name, to par, r1, r2, r3, r4, total
The r${round} column contains the tee time (like "1:07 PM" or "10:55 AM*")
- Times with * at the end mean the player starts on hole 10 (back 9)
- Times without * mean the player starts on hole 1 (front 9)

Return ONLY a valid JSON array with entries for each player who has a tee time in the r${round} column.
Each entry should have:
- "player": The golfer's FULL name (not abbreviated)
- "tee_time": The tee time WITHOUT the asterisk (e.g., "10:55 AM")  
- "starting_tee": 10 if the time had an asterisk (*), otherwise 1

Skip any players marked as CUT, WD, or DQ.

Example output:
[
  {"player": "Justin Rose", "tee_time": "1:07 PM", "starting_tee": 1},
  {"player": "Adam Schenk", "tee_time": "10:55 AM", "starting_tee": 10}
]

Return ONLY the JSON array, no other text.

HTML TABLE:
${tableHtml}`;

  try {
    console.log(`[SYNC-TEE-TIMES] Asking Gemini to parse R${round} tee times from CBS Sports HTML...`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up the response - remove markdown code blocks if present
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.slice(7);
    }
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();

    // Parse JSON
    const teeTimes: TeeTimeEntry[] = JSON.parse(cleanedText);
    
    if (!Array.isArray(teeTimes)) {
      console.error('[SYNC-TEE-TIMES] Gemini response is not an array');
      return { teeTimes: null, error: 'Gemini response is not a valid array' };
    }

    console.log(`[SYNC-TEE-TIMES] Gemini parsed ${teeTimes.length} tee times from CBS Sports`);
    return { teeTimes };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SYNC-TEE-TIMES] Error parsing with Gemini:', errorMsg);
    return { teeTimes: null, error: `Gemini API error: ${errorMsg}` };
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow bypass for manual testing with ?manual=true
  const isManual = request.nextUrl.searchParams.get('manual') === 'true';
  // Force bypass existing tee times check with ?force=true
  const forceUpdate = request.nextUrl.searchParams.get('force') === 'true';
  // Optionally specify round with ?round=3 or ?round=4
  const specifiedRound = request.nextUrl.searchParams.get('round');
  
  if (!isManual && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    // Find the active tournament
    const { data: activeTournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, current_round, status')
      .eq('status', 'active')
      .single();

    if (tournamentError || !activeTournament) {
      return NextResponse.json({
        success: false,
        message: 'No active tournament found',
      });
    }

    const currentRound = activeTournament.current_round || 2;
    
    // Determine which round's tee times to fetch
    // If current_round is 2 (R2 complete), fetch R3 tee times
    // If current_round is 3 (R3 complete), fetch R4 tee times
    // Can be overridden with ?round=3 or ?round=4 for testing
    let targetRound: number;
    let teeTimeColumn: string;
    let startingTeeColumn: string;

    if (specifiedRound === '3' || specifiedRound === '4') {
      targetRound = parseInt(specifiedRound, 10);
    } else if (currentRound <= 2) {
      targetRound = 3;
    } else if (currentRound === 3) {
      targetRound = 4;
    } else {
      return NextResponse.json({
        success: true,
        message: 'Tournament is in final round, no tee times to fetch',
      });
    }

    if (targetRound === 3) {
      teeTimeColumn = 'tee_time_r3';
      startingTeeColumn = 'starting_tee_r3';
    } else {
      teeTimeColumn = 'tee_time_r4';
      startingTeeColumn = 'starting_tee_r4';
    }

    // Check if tee times already exist for this round (skip if force=true)
    if (!forceUpdate) {
      const { data: existingTeeTimes } = await supabase
        .from('tournament_players')
        .select(teeTimeColumn)
        .eq('tournament_id', activeTournament.id)
        .not(teeTimeColumn, 'is', null)
        .limit(1);

      if (existingTeeTimes && existingTeeTimes.length > 0) {
        return NextResponse.json({
          success: true,
          message: `R${targetRound} tee times already exist for ${activeTournament.name}. Use ?force=true to overwrite.`,
        });
      }
    }

    // Step 1: Fetch CBS Sports leaderboard page
    const cbsResult = await fetchCBSSportsPage();
    
    if (!cbsResult.html) {
      return NextResponse.json({
        success: false,
        message: `Could not fetch CBS Sports leaderboard`,
        error: cbsResult.error,
      });
    }

    // Step 2: Parse tee times from HTML using Gemini
    const geminiResult = await parseTeeTimesWithGemini(cbsResult.html, targetRound);

    if (!geminiResult.teeTimes || geminiResult.teeTimes.length === 0) {
      return NextResponse.json({
        success: false,
        message: `Could not parse R${targetRound} tee times from CBS Sports`,
        error: geminiResult.error,
      });
    }

    const teeTimes = geminiResult.teeTimes;

    // Get tournament players with their PGA player names
    const { data: tournamentPlayers, error: tpError } = await supabase
      .from('tournament_players')
      .select('id, pga_player_id, pga_players(name)')
      .eq('tournament_id', activeTournament.id);

    if (tpError) {
      throw tpError;
    }

    // Create a map of normalized names to tournament_player IDs
    const nameToIdMap = new Map<string, string>();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tournamentPlayers?.forEach((tp: any) => {
      // pga_players comes back as an array from the join
      const pgaPlayer = Array.isArray(tp.pga_players) ? tp.pga_players[0] : tp.pga_players;
      const playerName = pgaPlayer?.name;
      if (playerName) {
        const normalized = normalizeName(playerName);
        nameToIdMap.set(normalized, tp.id);
        
        // Add first name variations
        const firstName = normalized.split(' ')[0];
        const lastName = normalized.split(' ').slice(1).join(' ');
        const nicknames = nicknameMap[firstName] || [];
        for (const nickname of nicknames) {
          nameToIdMap.set(`${nickname} ${lastName}`, tp.id);
        }
      }
    });

    // Find match with nickname fallback
    const findMatch = (jsonName: string): string | null => {
      const normalized = normalizeName(jsonName);
      
      // Direct match
      if (nameToIdMap.has(normalized)) {
        return nameToIdMap.get(normalized)!;
      }
      
      // Try nickname variations
      const firstName = normalized.split(' ')[0];
      const lastName = normalized.split(' ').slice(1).join(' ');
      const nicknames = nicknameMap[firstName] || [];
      
      for (const nickname of nicknames) {
        const altName = `${nickname} ${lastName}`;
        if (nameToIdMap.has(altName)) {
          return nameToIdMap.get(altName)!;
        }
      }
      
      return null;
    };

    // Update tee times
    let matchedCount = 0;
    const unmatchedNames: string[] = [];

    for (const entry of teeTimes) {
      const tournamentPlayerId = findMatch(entry.player);

      if (tournamentPlayerId) {
        const updateData: Record<string, string | number> = { 
          [teeTimeColumn]: entry.tee_time,
          [startingTeeColumn]: entry.starting_tee || 1,
        };
        
        const { error: updateError } = await supabase
          .from('tournament_players')
          .update(updateData)
          .eq('id', tournamentPlayerId);

        if (!updateError) {
          matchedCount++;
        }
      } else {
        unmatchedNames.push(entry.player);
      }
    }

    const resultMessage = `Updated R${targetRound} tee times for ${matchedCount} of ${teeTimes.length} players`;
    console.log(`[SYNC-TEE-TIMES] ${resultMessage}`);
    
    if (unmatchedNames.length > 0) {
      console.log(`[SYNC-TEE-TIMES] Unmatched players: ${unmatchedNames.join(', ')}`);
    }

    return NextResponse.json({
      success: true,
      tournament: activeTournament.name,
      round: targetRound,
      matchedCount,
      totalFromGemini: teeTimes.length,
      unmatchedNames: unmatchedNames.length > 0 ? unmatchedNames : undefined,
      message: resultMessage,
    });

  } catch (error) {
    console.error('[SYNC-TEE-TIMES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
