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
  // For date-only strings like "2026-02-05", parse as local time to avoid
  // timezone shift (new Date("2026-02-05") parses as UTC midnight, which
  // shifts back a day in US timezones)
  let d: Date;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, day] = date.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = typeof date === 'string' ? new Date(date) : date;
  }
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

/**
 * First initial + full last name for tight spaces (e.g. mobile).
 * "Andrew Schuessler" -> "A. Schuessler". Single word unchanged.
 */
export function formatShortName(fullName: string): string {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    return `${first.charAt(0).toUpperCase()}. ${last}`;
  }
  return trimmed;
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
