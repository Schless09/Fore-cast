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
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="mb-2">{tournament.name}</CardTitle>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {tournament.course && (
                <span>📍 {tournament.course}</span>
              )}
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
              statusColors[tournament.status]
            }`}
          >
            {tournament.status}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">
            <p>{formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}</p>
            {tournament.status === 'active' && (
              <p className="mt-1 font-medium text-gray-900">
                Round {safeRoundNumber(tournament.current_round)}/4
              </p>
            )}
          </div>
        </div>
        <Link href={`/tournaments/${tournament.id}`}>
          <Button variant="outline" className="w-full">
            {tournament.status === 'upcoming' ? 'View & Create Roster' : 'View Leaderboard'}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
