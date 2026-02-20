import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/chat/league-read
 * Marks league chat as read for the authenticated user.
 * Called when the user views the League Chat tab.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const leagueId = typeof body?.leagueId === 'string' ? body.leagueId : null;
    if (!leagueId) {
      return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('league_chat_read_state')
      .upsert(
        {
          user_id: userId,
          league_id: leagueId,
          last_read_at: now,
          updated_at: now,
        },
        {
          onConflict: 'user_id,league_id',
          ignoreDuplicates: false,
        }
      );

    if (error) {
      console.error('[league-read]', error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
