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
  if (score === null || score === undefined) return 'text-casino-gray';
  if (score < 0) return 'text-casino-green font-semibold';
  if (score === 0) return 'text-casino-gold';
  return 'text-casino-red';
}

export function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    // Uses user's local timezone automatically
  }).format(d);
}

// Legacy alias for backward compatibility
export const formatTimestampCST = formatTimestamp;
