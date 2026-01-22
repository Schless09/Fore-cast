import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number | null): string {
  if (score === null || score === undefined) return '-';
  if (score === 0) return 'E';
  if (score > 0) return `+${score}`;
  return score.toString();
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function getScoreColor(score: number | null): string {
  if (score === null || score === undefined) return 'text-gray-500';
  if (score < 0) return 'text-green-600 font-semibold';
  if (score === 0) return 'text-yellow-600';
  return 'text-red-600';
}

export function formatTimestampCST(timestamp: number): string {
  const d = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  }).format(d);
}
