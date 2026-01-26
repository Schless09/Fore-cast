'use client';

import { useState, useEffect } from 'react';

interface LiveRoundBadgeProps {
  liveGolfAPITournamentId: string;
  fallbackRound?: number;
}

export function LiveRoundBadge({ liveGolfAPITournamentId, fallbackRound = 1 }: LiveRoundBadgeProps) {
  const [currentRound, setCurrentRound] = useState<number>(fallbackRound);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function fetchRound() {
      try {
        const response = await fetch(`/api/scores/live?eventId=${liveGolfAPITournamentId}`);
        const result = await response.json();
        
        if (result.currentRound) {
          setCurrentRound(result.currentRound);
        }
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to fetch round:', error);
        setIsLoaded(true);
      }
    }

    fetchRound();
  }, [liveGolfAPITournamentId]);

  return (
    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
      Round {currentRound}/4
    </span>
  );
}
