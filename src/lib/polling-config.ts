/**
 * Smart Polling Configuration for Live Golf Scores
 * 
 * Optimizes API calls based on tournament schedule:
 * - Only polls on tournament days (Thu-Sun)
 * - Hourly polling to conserve API credits
 * - No hour restrictions (tournaments can be in any time zone)
 * 
 * Budget calculation (5 tournaments/month):
 * - Thu-Sun: 24 hrs × 1 call/hr = 24 calls per day
 * - Total per tournament: ~96 calls (4 days × 24 calls)
 * - Monthly (5 tournaments): ~480 calls
 * 
 * Note: The cron only polls when there's an active tournament in the DB.
 * No active tournament = no API calls, regardless of day/time.
 */

export interface TournamentDay {
  day: 'thursday' | 'friday' | 'saturday' | 'sunday';
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat
  pollIntervalMinutes: number;
  description: string;
}

// Tournament schedule - polls all day on Thu-Sun
// No hour restrictions since tournaments can be in any time zone
// (East Coast, West Coast, Hawaii, Scotland, etc.)
export const TOURNAMENT_SCHEDULE: TournamentDay[] = [
  {
    day: 'thursday',
    dayOfWeek: 4,
    pollIntervalMinutes: 60,
    description: 'Round 1 - Hourly polling',
  },
  {
    day: 'friday',
    dayOfWeek: 5,
    pollIntervalMinutes: 60,
    description: 'Round 2 - Hourly polling',
  },
  {
    day: 'saturday',
    dayOfWeek: 6,
    pollIntervalMinutes: 60,
    description: 'Round 3 - Hourly polling',
  },
  {
    day: 'sunday',
    dayOfWeek: 0,
    pollIntervalMinutes: 60,
    description: 'Final Round - Hourly polling',
  },
];

// Non-tournament days - very infrequent polling to check for updates
export const OFF_TOURNAMENT_POLL_INTERVAL_MINUTES = 60; // 1 hour

/**
 * Determines if we should poll right now based on tournament schedule
 * 
 * Since cron runs every 4 minutes, we use minute modulo to implement
 * variable polling rates:
 * - Sat/Sun (4 min): poll every cron run
 * - Thu/Fri (8 min): poll every other cron run
 * 
 * No hour restrictions - tournaments can be in any time zone.
 * The cron only makes API calls when there's an active tournament in the DB.
 */
export function shouldPollNow(now: Date = new Date()): {
  shouldPoll: boolean;
  reason: string;
  nextPollMinutes: number;
  currentConfig: TournamentDay | null;
} {
  const dayOfWeek = now.getUTCDay();
  const minuteUTC = now.getUTCMinutes();

  // Find if today is a tournament day
  const todayConfig = TOURNAMENT_SCHEDULE.find(d => d.dayOfWeek === dayOfWeek);

  if (!todayConfig) {
    // Not a tournament day (Mon, Tue, Wed)
    return {
      shouldPoll: false,
      reason: `Not a tournament day (${getDayName(dayOfWeek)})`,
      nextPollMinutes: OFF_TOURNAMENT_POLL_INTERVAL_MINUTES,
      currentConfig: null,
    };
  }

  // Tournament day - check if this is a poll minute based on interval
  // Cron runs every 4 minutes, so we check if current minute aligns with the interval
  const interval = todayConfig.pollIntervalMinutes;
  
  // For 4 min interval (Sat/Sun), always poll every cron run
  // For 8 min interval (Thu/Fri), poll every other cron run
  
  // Round to nearest interval boundary
  const nearestBoundary = Math.round(minuteUTC / interval) * interval;
  const distanceToBoundary = Math.abs(minuteUTC - nearestBoundary);
  
  // If we're within 2 minutes of an interval boundary, poll
  // (cron might be 1-2 min off due to scheduling variance)
  const shouldPollThisRun = distanceToBoundary <= 2;

  if (!shouldPollThisRun) {
    return {
      shouldPoll: false,
      reason: `Waiting for ${interval} min interval (next at :${String(nearestBoundary % 60).padStart(2, '0')})`,
      nextPollMinutes: distanceToBoundary,
      currentConfig: todayConfig,
    };
  }

  // Tournament day and at correct interval - should poll!
  return {
    shouldPoll: true,
    reason: todayConfig.description,
    nextPollMinutes: todayConfig.pollIntervalMinutes,
    currentConfig: todayConfig,
  };
}

/**
 * Get the recommended poll interval in milliseconds
 */
export function getPollIntervalMs(now: Date = new Date()): number {
  const { nextPollMinutes } = shouldPollNow(now);
  return nextPollMinutes * 60 * 1000;
}

/**
 * Calculate estimated API calls for the month
 * 
 * Assumes ~12 hours of actual play per day (realistic estimate)
 * even though we poll all 24 hours to handle any time zone.
 */
export function estimateMonthlyApiCalls(tournamentsPerMonth: number = 4): {
  perTournament: number;
  total: number;
  remaining: number;
  budget: number;
} {
  const budget = 2000;
  const activeHoursPerDay = 12; // Realistic estimate of play hours
  
  // Calculate calls per tournament
  let perTournament = 0;
  for (const day of TOURNAMENT_SCHEDULE) {
    const callsPerHour = 60 / day.pollIntervalMinutes;
    perTournament += activeHoursPerDay * callsPerHour;
  }

  const total = Math.round(perTournament * tournamentsPerMonth);
  
  return {
    perTournament: Math.round(perTournament),
    total,
    remaining: budget - total,
    budget,
  };
}

function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
}

/**
 * Check if a tournament is likely in progress based on its dates
 */
export function isTournamentInProgress(
  startDate: string | Date,
  endDate: string | Date,
  now: Date = new Date()
): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Add buffer: tournaments might have data available a day before/after
  start.setDate(start.getDate() - 1);
  end.setDate(end.getDate() + 1);
  
  return now >= start && now <= end;
}

// Export for debugging
export function getPollingDebugInfo(now: Date = new Date()): string {
  const status = shouldPollNow(now);
  const estimate = estimateMonthlyApiCalls(5);
  
  return `
=== Polling Debug Info ===
Current Time: ${now.toISOString()}
UTC Hour: ${now.getUTCHours()}
Day of Week: ${getDayName(now.getUTCDay())}

Should Poll: ${status.shouldPoll}
Reason: ${status.reason}
Next Poll In: ${status.nextPollMinutes} minutes

Monthly Estimate (5 tournaments):
- Per Tournament: ${estimate.perTournament} calls
- Total: ${estimate.total} calls
- Budget: ${estimate.budget} calls
- Remaining: ${estimate.remaining} calls
`.trim();
}
