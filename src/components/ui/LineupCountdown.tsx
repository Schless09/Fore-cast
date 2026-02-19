'use client';

import { useState, useEffect } from 'react';

interface LineupCountdownProps {
  /** Tournament start date (ISO string) */
  startDate: string;
  /** Earliest tee time in "HH:MM AM/PM" format (EST) */
  earliestTeeTime?: string;
  /** Tournament status */
  status?: 'upcoming' | 'active' | 'completed';
}

/**
 * Countdown timer showing time until lineup lock (first tee time)
 */
export function LineupCountdown({ startDate, earliestTeeTime, status }: LineupCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isLocked: boolean;
  } | null>(null);

  useEffect(() => {
    // Parse the earliest tee time or default to 12:00 PM EST
    const teeTime = earliestTeeTime || '12:00 PM';
    const match = teeTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    
    let teeHours = 12;
    let teeMinutes = 0;
    
    if (match) {
      teeHours = parseInt(match[1], 10);
      teeMinutes = parseInt(match[2], 10);
      const period = match[3].toUpperCase();
      
      if (period === 'PM' && teeHours !== 12) {
        teeHours += 12;
      } else if (period === 'AM' && teeHours === 12) {
        teeHours = 0;
      }
    }

    // Create target datetime in EST timezone
    // startDate is in format "YYYY-MM-DD"
    const [year, month, day] = startDate.split('-').map(Number);
    
    // Create an ISO string for the target time in EST (UTC-5)
    // Format: YYYY-MM-DDTHH:MM:SS-05:00
    const estTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(teeHours).padStart(2, '0')}:${String(teeMinutes).padStart(2, '0')}:00-05:00`;
    const targetDate = new Date(estTimeString);

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = targetDate.getTime() - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isLocked: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isLocked: false });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [startDate, earliestTeeTime]);

  // Don't show for completed tournaments
  if (status === 'completed') {
    return null;
  }

  if (!timeLeft) {
    return null;
  }

  if (timeLeft.isLocked || status === 'active') {
    return (
      <div className="bg-red-900/30 border border-red-500/50 rounded-lg px-4 py-2 inline-flex items-center gap-2">
        <span className="text-red-400 font-semibold">🔒 Lineups Locked</span>
      </div>
    );
  }

  // Format the countdown
  const formatUnit = (value: number, unit: string) => (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-bold text-casino-gold tabular-nums">{value.toString().padStart(2, '0')}</span>
      <span className="text-xs text-casino-gray uppercase">{unit}</span>
    </div>
  );

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 6;

  return (
    <div className={`${isUrgent ? 'bg-orange-900/30 border-orange-500/50' : 'bg-casino-dark/50 border-casino-gold/30'} border rounded-lg px-4 py-3`}>
      <div className="text-xs text-casino-gray mb-2 text-center">
        {isUrgent ? '⚠️ Lineup locks soon!' : `⏰ Lineup locks at first tee${earliestTeeTime ? ` (${earliestTeeTime})` : ''}`}
      </div>
      <div className="flex items-center justify-center gap-3">
        {timeLeft.days > 0 && (
          <>
            {formatUnit(timeLeft.days, 'days')}
            <span className="text-casino-gold text-xl">:</span>
          </>
        )}
        {formatUnit(timeLeft.hours, 'hrs')}
        <span className="text-casino-gold text-xl">:</span>
        {formatUnit(timeLeft.minutes, 'min')}
        <span className="text-casino-gold text-xl">:</span>
        {formatUnit(timeLeft.seconds, 'sec')}
      </div>
    </div>
  );
}
