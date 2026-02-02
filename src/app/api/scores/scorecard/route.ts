import { NextRequest, NextResponse } from 'next/server';
import { CACHE_TTL_MS } from '@/lib/config';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Fetch player scorecard from RapidAPI Live Golf Data
 */

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

interface CacheEntry {
  data: any;
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();

// No more mapping needed - use year/tournId directly

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('playerId');
  
  // Accept direct params
  const year = searchParams.get('year');
  const tournId = searchParams.get('tournId');
  const orgId = searchParams.get('orgId') || '1'; // Default to PGA Tour

  if (!RAPIDAPI_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  if (!year || !tournId || !playerId) {
    return NextResponse.json({ 
      error: 'Missing required parameters',
      hint: 'Use ?year=2026&tournId=002&playerId=<id>'
    }, { status: 400 });
  }

  const cacheKey = `${year}-${tournId}-${playerId}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    const cacheAge = Math.round((Date.now() - cached.timestamp) / 1000);
    console.log(`[Scorecard] ✅ Returning cached data (${cacheAge}s old)`);
    return NextResponse.json({
      ...cached.data,
      source: 'cache',
      cacheAge,
    });
  }

  try {
    console.log(`[Scorecard] Fetching scorecard: year=${year}, tournId=${tournId}, playerId=${playerId}`);
    
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/scorecard?orgId=${orgId}&tournId=${tournId}&year=${year}&playerId=${playerId}`,
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
      console.error(`[Scorecard] RapidAPI error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `RapidAPI error (${response.status})`, data: null },
        { status: response.status }
      );
    }

    const json = await response.json();
    
    // API returns an array of round objects (one per round)
    const roundsArray = Array.isArray(json) ? json : [json];
    
    if (roundsArray.length === 0) {
      return NextResponse.json({ 
        data: null, 
        error: 'No scorecard data found',
        source: 'rapidapi' 
      });
    }
    
    // Get course name from our database
    const supabase = createServiceClient();
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('course, name')
      .eq('rapidapi_tourn_id', tournId)
      .single();
    
    const courseName = tournament?.course || '';
    
    // Get player info from first round
    const firstRound = roundsArray[0];
    
    // Transform to a cleaner format
    const scorecard = {
      player: {
        id: firstRound.playerId,
        firstName: firstRound.firstName,
        lastName: firstRound.lastName,
        country: firstRound.country || '',
      },
      tournament: {
        name: tournament?.name || '',
        courseName: courseName,
      },
      rounds: roundsArray.map((round: any) => {
        // holes is an object keyed by hole number, convert to sorted array
        const holesObj = round.holes || {};
        const holesArray = Object.keys(holesObj)
          .map(key => {
            const hole = holesObj[key];
            const holeNum = hole.holeId?.$numberInt || hole.holeId || parseInt(key);
            const par = hole.par?.$numberInt || hole.par;
            const strokes = hole.holeScore?.$numberInt || hole.holeScore;
            return {
              holeNumber: holeNum,
              par: par,
              strokes: strokes,
              scoreToPar: strokes - par,
            };
          })
          .sort((a, b) => a.holeNumber - b.holeNumber);
        
        return {
          roundNumber: round.roundId?.$numberInt || round.roundId,
          courseName: round.courseName || round.course || courseName,
          scoreToPar: round.currentRoundScore || '0',
          strokes: round.totalShots?.$numberInt || round.totalShots,
          holes: holesArray,
          roundComplete: round.roundComplete,
        };
      }).sort((a: any, b: any) => a.roundNumber - b.roundNumber),
      currentRound: roundsArray.length,
      totalScore: roundsArray.reduce((sum: number, r: any) => {
        const score = r.currentRoundScore;
        if (!score) return sum;
        if (score === 'E') return sum;
        return sum + parseInt(score);
      }, 0).toString(),
    };
    
    // Format total score
    if (parseInt(scorecard.totalScore) > 0) {
      scorecard.totalScore = `+${scorecard.totalScore}`;
    } else if (parseInt(scorecard.totalScore) === 0) {
      scorecard.totalScore = 'E';
    }

    console.log(`[Scorecard] ✅ Fetched ${scorecard.rounds.length} rounds for ${scorecard.player.firstName} ${scorecard.player.lastName}`);

    const responseData = {
      data: scorecard,
      source: 'rapidapi',
      timestamp: Date.now(),
    };

    // Store in cache
    cache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now(),
    });

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('[Scorecard] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch scorecard', data: null },
      { status: 500 }
    );
  }
}
