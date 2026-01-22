'use client';

import { useRouter } from 'next/navigation';

interface Tournament {
  id: string;
  name: string;
  status: string;
  start_date: string;
}

interface TournamentSelectorProps {
  tournaments: Tournament[];
  currentTournamentId: string;
  currentWeekTournamentId: string | null;
  basePath: string; // e.g., "/standings/weekly"
}

export function TournamentSelector({
  tournaments,
  currentTournamentId,
  currentWeekTournamentId,
  basePath,
}: TournamentSelectorProps) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTournamentId = e.target.value;
    router.push(`${basePath}/${newTournamentId}`);
  };

  return (
    <select
      value={currentTournamentId}
      onChange={handleChange}
      className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900"
    >
      {tournaments.map((t) => {
        const isCurrentWeek = t.id === currentWeekTournamentId;
        const statusEmoji = 
          isCurrentWeek ? '⭐ ' :
          t.status === 'active' ? '🔴 ' :
          t.status === 'upcoming' ? '📅 ' :
          '✅ ';
        
        return (
          <option key={t.id} value={t.id}>
            {statusEmoji}{t.name}{isCurrentWeek ? ' (Current Week)' : ''}
          </option>
        );
      })}
    </select>
  );
}
