'use client';

import { useMemo, useState } from 'react';
import { Tournament } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

type ViewMode = 'current' | 'past' | 'future';

interface TournamentsSwitcherProps {
  currentTournament: Tournament | null;
  futureTournaments: Tournament[];
  pastTournaments: Tournament[];
}

function getMondayBeforeTournament(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay(); // 0 = Sunday, 1 = Monday
  const diffToMonday = day === 0 ? -6 : 1 - day; // move back/forward to Monday
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  return monday;
}

function isAfterMondayNoonCST(mondayDate: Date): boolean {
  const now = new Date();
  
  // Get current time in CST
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const nowCSTObj = {
    year: parseInt(parts.find(p => p.type === 'year')?.value || '0'),
    month: parseInt(parts.find(p => p.type === 'month')?.value || '0'),
    day: parseInt(parts.find(p => p.type === 'day')?.value || '0'),
    hour: parseInt(parts.find(p => p.type === 'hour')?.value || '0'),
    minute: parseInt(parts.find(p => p.type === 'minute')?.value || '0'),
  };
  
  // Get Monday date parts
  const mondayYear = mondayDate.getFullYear();
  const mondayMonth = mondayDate.getMonth() + 1;
  const mondayDay = mondayDate.getDate();
  
  // Compare: if we're past the Monday date, or same day but past noon
  if (nowCSTObj.year > mondayYear) return true;
  if (nowCSTObj.year < mondayYear) return false;
  
  if (nowCSTObj.month > mondayMonth) return true;
  if (nowCSTObj.month < mondayMonth) return false;
  
  if (nowCSTObj.day > mondayDay) return true;
  if (nowCSTObj.day < mondayDay) return false;
  
  // Same day - check if past noon (12:00)
  return nowCSTObj.hour >= 12;
}

function getRosterAvailabilityMessage(tournament: Tournament): string {
  if (tournament.status !== 'upcoming') return '';
  
  const monday = getMondayBeforeTournament(tournament.start_date);
  const isPastDeadline = isAfterMondayNoonCST(monday);
  
  if (isPastDeadline) {
    return 'Roster creation is now open! Click below to build your team.';
  }
  
  return `Roster creation opens at Noon CST on Monday, ${formatDate(monday.toISOString().substring(0, 10))}.`;
}

function TournamentCardFeatured({ tournament }: { tournament: Tournament }) {
  const isUpcoming = tournament.status === 'upcoming';
  const isCompleted = tournament.status === 'completed';
  const mondayMsg = getRosterAvailabilityMessage(tournament);
  const ctaLabel = isCompleted ? 'View Completed Leaderboard' : 'View & Create Roster';

  return (
    <Card className="border-green-200 shadow-md">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center justify-between">
          <span>{tournament.name}</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
              isUpcoming
                ? 'bg-blue-100 text-blue-800'
                : tournament.status === 'active'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {tournament.status}
          </span>
        </CardTitle>
        {tournament.course && (
          <p className="text-sm text-casino-text">
            <span className="font-medium">{tournament.course}</span>
            {tournament.course_par && (
              <span className="text-casino-gray ml-1">&middot; Par {tournament.course_par}</span>
            )}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
          <span>{formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}</span>
          {tournament.course_location && (
            <span>{tournament.course_location}</span>
          )}
        </div>
        {tournament.status === 'active' && (
          <p className="text-sm text-green-700 font-semibold mt-2">Live now — build or track your roster.</p>
        )}
        {isUpcoming && mondayMsg && (
          <p className={`text-sm font-semibold mt-2 ${
            mondayMsg.includes('now open') ? 'text-green-700' : 'text-blue-700'
          }`}>
            {mondayMsg}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <p className="text-gray-700 flex-1">
          Draft your roster of up to 10 golfers under the $30 cap and track live prize money standings.
        </p>
        <div className="flex gap-3">
          <Link href={`/tournaments/${tournament.id}`}>
            <Button variant="outline">{ctaLabel}</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function TournamentCardCompact({ tournament }: { tournament: Tournament }) {
  const isUpcoming = tournament.status === 'upcoming';
  const isCompleted = tournament.status === 'completed';
  const mondayMsg = getRosterAvailabilityMessage(tournament);
  const ctaLabel = isCompleted ? 'View Completed Leaderboard' : 'View & Create Roster';

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{tournament.name}</CardTitle>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap shrink-0 ${
              isUpcoming
                ? 'bg-blue-100 text-blue-800'
                : tournament.status === 'active'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {tournament.status}
          </span>
        </div>
        {tournament.course && (
          <p className="text-xs text-casino-text">
            <span className="font-medium">{tournament.course}</span>
            {tournament.course_par && (
              <span className="text-casino-gray ml-1">&middot; Par {tournament.course_par}</span>
            )}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-gray-600">
          <span>{formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}</span>
          {tournament.course_location && (
            <span>{tournament.course_location}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isUpcoming && mondayMsg && (
          <p className={`text-xs font-medium ${
            mondayMsg.includes('now open') ? 'text-green-700' : 'text-blue-700'
          }`}>
            {mondayMsg}
          </p>
        )}
        <div className="flex justify-end">
          <Link href={`/tournaments/${tournament.id}`}>
            <Button size="sm" variant="outline">{ctaLabel}</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function TournamentsSwitcher({
  currentTournament,
  futureTournaments,
  pastTournaments,
}: TournamentsSwitcherProps) {
  const [view, setView] = useState<ViewMode>('current');

  const viewData = useMemo(() => {
    if (view === 'current') return [];
    if (view === 'future') return futureTournaments;
    return pastTournaments;
  }, [view, futureTournaments, pastTournaments]);

  return (
    <div className="space-y-6">
      {/* Featured current/next tournament */}
      {currentTournament ? (
        <TournamentCardFeatured tournament={currentTournament} />
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-gray-600">
            No tournaments available yet.
          </CardContent>
        </Card>
      )}

      {/* Toggle buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={view === 'current' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setView('current')}
        >
          Current
        </Button>
        <Button
          variant={view === 'future' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setView('future')}
        >
          Future
        </Button>
        <Button
          variant={view === 'past' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setView('past')}
        >
          Past
        </Button>
      </div>

      {/* Listing based on view */}
      {view === 'current' && (
        <p className="text-sm text-gray-600">
          Showing the current (active) tournament, or the next upcoming tournament if none are active.
        </p>
      )}

      {view !== 'current' && viewData.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-gray-600">
            {view === 'future' ? 'No future tournaments available.' : 'No past tournaments available.'}
          </CardContent>
        </Card>
      )}

      {view !== 'current' && viewData.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {viewData.map((tournament) => (
            <TournamentCardCompact key={tournament.id} tournament={tournament} />
          ))}
        </div>
      )}
    </div>
  );
}

