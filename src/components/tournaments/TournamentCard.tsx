import Link from 'next/link';
import { Tournament } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';

// Helper to safely extract round number from potentially MongoDB extended JSON format
function safeRoundNumber(round: unknown): number {
  if (typeof round === 'object' && round !== null && '$numberInt' in round) {
    return parseInt((round as { $numberInt: string }).$numberInt, 10) || 1;
  }
  if (typeof round === 'number') return round;
  if (typeof round === 'string') return parseInt(round, 10) || 1;
  return 1;
}

interface TournamentCardProps {
  tournament: Tournament;
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const statusColors = {
    upcoming: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg sm:text-xl">{tournament.name}</CardTitle>
              {tournament.status === 'active' && (
                <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium whitespace-nowrap">
                  Round {safeRoundNumber(tournament.current_round)}/4
                </span>
              )}
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap shrink-0 ${
                statusColors[tournament.status]
              }`}
            >
              {tournament.status}
            </span>
          </div>
          {tournament.course && (
            <div className="text-sm text-casino-text">
              <span className="font-medium">{tournament.course}</span>
              {tournament.course_par && (
                <span className="text-casino-gray ml-1">&middot; Par {tournament.course_par}</span>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-casino-gray">
            <span>{formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}</span>
            {tournament.course_location && (
              <span>{tournament.course_location}</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Link href={`/tournaments/${tournament.id}`}>
          <Button variant="outline" className="w-full">
            {tournament.status === 'upcoming' ? 'View & Create Roster' : 'View Leaderboard'}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
