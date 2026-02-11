'use client';

import { convertESTtoLocal } from '@/lib/timezone';

/** Badge showing roster lock message with earliest tee time in user's local timezone (stored as EST). */
export function RosterLockedBadge({ earliestTeeTimeEST }: { earliestTeeTimeEST: string | null }) {
  const displayTime = earliestTeeTimeEST ? convertESTtoLocal(earliestTeeTimeEST) : null;
  return (
    <div className="text-xs text-casino-gray bg-casino-card border border-casino-gold/20 px-3 py-1 rounded-md whitespace-nowrap self-start">
      🔒 Rosters locked until tournament starts{displayTime ? ` (${displayTime})` : ''}
    </div>
  );
}
