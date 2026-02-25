'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  CheckAndClearTeeTimesCard,
  ManualTeeTimesUpload,
  WeekendTeeTimesUpload,
} from '@/components/admin/tee-times';

interface Tournament {
  id: string;
  name: string;
  start_date: string;
  status: string;
}

export default function TeeTimesAdminPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, start_date, status')
        .order('start_date', { ascending: false });
      if (error) {
        setTournaments([]);
      } else {
        setTournaments(data ?? []);
      }
      setIsLoading(false);
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-casino-gold mb-6">Upload Tee Times</h1>
      <p className="text-casino-gray mb-6">
        Upload Round 1 and Round 2 tee times for a tournament. CBS sync runs Tue–Thu; use manual
        upload if tee times are missing.
      </p>

      <CheckAndClearTeeTimesCard />

      <ManualTeeTimesUpload
        tournaments={tournaments}
        selectedTournamentId={selectedTournamentId}
        onTournamentChange={setSelectedTournamentId}
      />

      <WeekendTeeTimesUpload
        tournaments={tournaments}
        selectedTournamentId={selectedTournamentId}
        onTournamentChange={setSelectedTournamentId}
      />
    </div>
  );
}
