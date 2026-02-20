'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

const POLL_INTERVAL_MS = 30_000;

export function useUnreadMessages() {
  const { user, isSignedIn } = useUser();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  // Hide badge when user is on chat page (they're "seeing" the messages)
  const isOnChatPage = pathname === '/chat';

  const fetchUnreadCount = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const res = await fetch('/api/chat/unread-count');
      const data = await res.json();
      setUnreadCount(typeof data.count === 'number' ? data.count : 0);
    } catch {
      setUnreadCount(0);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!user || !isSignedIn) {
      setUnreadCount(0);
      return;
    }

    fetchUnreadCount();

    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, isSignedIn, fetchUnreadCount]);

  // Re-fetch when leaving chat page (user may have read messages)
  useEffect(() => {
    if (!isOnChatPage && user && isSignedIn) {
      fetchUnreadCount();
    }
  }, [pathname, isOnChatPage, user, isSignedIn, fetchUnreadCount]);

  // Badge disappears when user is on chat page
  return isOnChatPage ? 0 : unreadCount;
}
