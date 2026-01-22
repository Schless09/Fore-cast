import { NextRequest, NextResponse } from 'next/server';
import { fetchScoresFromLiveGolfAPI } from '@/lib/livegolfapi';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'eventId required' }, { status: 400 });
    }

    console.log('Testing LiveGolfAPI for event:', eventId);

    const result = await fetchScoresFromLiveGolfAPI(eventId);

    if (!result.data || !Array.isArray(result.data)) {
      return NextResponse.json({
        error: 'No data received',
        source: result.source
      }, { status: 404 });
    }

    // Return detailed info about first player
    const firstPlayer = result.data[0];
    const response = {
      source: result.source,
      totalPlayers: result.data.length,
      firstPlayer: {
        name: firstPlayer.player,
        position: firstPlayer.positionValue,
        total: firstPlayer.total,
        thru: firstPlayer.rounds?.[0]?.thru,
        hasDetailedScores: !!(firstPlayer.rounds?.[0]?.scores && firstPlayer.rounds[0].scores.length > 0),
        scoreCount: firstPlayer.rounds?.[0]?.scores?.length || 0,
        sampleScores: firstPlayer.rounds?.[0]?.scores?.slice(0, 3) || []
      }
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Test API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}