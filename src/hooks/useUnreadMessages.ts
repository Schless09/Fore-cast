'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@clerk/nextjs';

export function useUnreadMessages() {
  const { user } = useUser();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();

  // Hide badge when user is on chat page (they're "seeing" the messages)
  const isOnChatPage = pathname === '/chat';

  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    async function fetchUnreadCount() {
      // Get conversations where user is a participant
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

      if (!conversations || conversations.length === 0) {
        setUnreadCount(0);
        return;
      }

      const conversationIds = conversations.map(c => c.id);

      // Count unread messages (not sent by user, not read)
      const { count } = await supabase
        .from('conversation_messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', userId)
        .is('read_at', null);

      setUnreadCount(count || 0);
    }

    fetchUnreadCount();

    // Subscribe to new messages
    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
        },
        (payload) => {
          // If message is from someone else, increment count
          if (payload.new.sender_id !== userId) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_messages',
        },
        (payload) => {
          // If message was marked as read, decrement count
          if (payload.old.read_at === null && payload.new.read_at !== null) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  // Badge disappears when user is on chat page
  return isOnChatPage ? 0 : unreadCount;
}
