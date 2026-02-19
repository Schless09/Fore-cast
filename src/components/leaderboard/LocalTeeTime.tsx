'use client';

import { useState, useEffect } from 'react';
import { formatTeeTimeForDisplay } from '@/lib/timezone';

/**
 * Renders a tee time in the user's local timezone.
 * Only converts on the client (after mount) so we use the browser's timezone.
 * Handles ESPN full datetimes (e.g. "Thu Feb 19 08:03:00 PST 2026") and
 * time-only strings (e.g. "11:35 AM" assumed Eastern from RapidAPI/DB).
 */
export function LocalTeeTime({ teeTime, className }: { teeTime: string; className?: string }) {
  const [localTime, setLocalTime] = useState<string | null>(null);

  useEffect(() => {
    setLocalTime(formatTeeTimeForDisplay(teeTime));
  }, [teeTime]);

  return <span className={className}>{localTime ?? teeTime}</span>;
}
