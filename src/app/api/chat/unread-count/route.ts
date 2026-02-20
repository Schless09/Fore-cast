import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * GET /api/chat/unread-count
 * Returns the count of unread messages (DMs + League Chat) for the authenticated user.
 * Used by the Navbar to show the chat notification badge.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ count: 0 });
    }

    const supabase = createServiceClient();
    let totalCount = 0;

    // --- DM unread count ---
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map((c) => c.id);
      const { count: dmCount } = await supabase
        .from('conversation_messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', userId)
        .is('read_at', null);
      totalCount += dmCount ?? 0;
    }

    // --- League Chat unread count ---
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_league_id')
      .eq('clerk_id', userId)
      .single();

    if (profile?.active_league_id) {
      const leagueId = profile.active_league_id;

      // Get when user last read league chat
      const { data: readState } = await supabase
        .from('league_chat_read_state')
        .select('last_read_at')
        .eq('user_id', userId)
        .eq('league_id', leagueId)
        .single();

      const lastReadAt = readState?.last_read_at ?? null;

      // Count league messages from others since last_read_at
      let leagueQuery = supabase
        .from('league_messages')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', leagueId)
        .neq('user_id', userId);

      if (lastReadAt) {
        leagueQuery = leagueQuery.gt('created_at', lastReadAt);
      }

      const { count: leagueCount } = await leagueQuery;
      totalCount += leagueCount ?? 0;
    }

    return NextResponse.json({ count: totalCount });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
