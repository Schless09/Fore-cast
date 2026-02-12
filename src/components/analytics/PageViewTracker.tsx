'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

const TRACKED_PREFIXES = ['/tournaments', '/standings/weekly', '/standings/season'];

export function PageViewTracker() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn || !pathname) return;
    const tracked = TRACKED_PREFIXES.some((p) => pathname.startsWith(p));
    if (!tracked) return;

    fetch('/api/analytics/page-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {}); // Fire-and-forget
  }, [pathname, isSignedIn]);

  return null;
}
