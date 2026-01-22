import { Tournament } from '@/lib/types';
import { TournamentCard } from './TournamentCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface TournamentListProps {
  tournaments: Tournament[];
  isLoading?: boolean;
}

export function TournamentList({ tournaments, isLoading }: TournamentListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (tournaments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">No tournaments available.</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tournaments.map((tournament) => (
        <TournamentCard key={tournament.id} tournament={tournament} />
      ))}
    </div>
  );
}
