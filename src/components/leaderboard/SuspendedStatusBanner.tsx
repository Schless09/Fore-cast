'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface TweetItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

interface ApiResponse {
  items: TweetItem[];
  account?: string;
  message?: string;
}

interface SuspendedStatusBannerProps {
  /** When true, fetches and shows PGA TOUR Comms tweets */
  isSuspended: boolean;
  /** Optional status detail from ESPN (e.g. "Round 1 - Suspended") */
  statusDetail?: string | null;
}

export function SuspendedStatusBanner({ isSuspended, statusDetail }: SuspendedStatusBannerProps) {
  const [tweets, setTweets] = useState<TweetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuspended) {
      setTweets([]);
      setError(null);
      return;
    }

    const doFetch = (isInitial = false) => {
      if (isInitial) setLoading(true);
      setError(null);
      fetch('/api/tournament-status/pga-comms?limit=3')
        .then((res) => res.json())
        .then((data: ApiResponse) => {
          setTweets(data.items || []);
          if (data.message && !data.items?.length) {
            setError(data.message);
          }
        })
        .catch(() => {
          setError('Could not load updates.');
        })
        .finally(() => {
          if (isInitial) setLoading(false);
        });
    };

    doFetch(true);
    const interval = setInterval(() => doFetch(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isSuspended]);

  if (!isSuspended) return null;

  return (
    <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-900/20 px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="text-lg" aria-hidden>
          ⏸️
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-yellow-400">
            Play suspended
            {statusDetail && (
              <span className="ml-1 font-normal text-yellow-300/90">— {statusDetail}</span>
            )}
          </p>
          <p className="mt-1 text-xs text-casino-gray">
            Latest from{' '}
            <a
              href="https://x.com/PGATOURComms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-casino-gold hover:underline"
            >
              @PGATOURComms
            </a>
            :
          </p>
          {loading && (
            <p className="mt-2 text-xs text-casino-gray">Loading updates…</p>
          )}
          {error && !tweets.length && (
            <p className="mt-2 text-xs text-casino-gray">
              {error}{' '}
              <a
                href="https://x.com/PGATOURComms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-casino-gold hover:underline"
              >
                View on X →
              </a>
            </p>
          )}
          {tweets.length > 0 && (
            <ul className="mt-2 space-y-2">
              {tweets.map((t, i) => {
                const timeAgo = t.pubDate
                  ? (() => {
                      try {
                        const d = new Date(t.pubDate);
                        if (!Number.isNaN(d.getTime())) {
                          return formatDistanceToNow(d, { addSuffix: true });
                        }
                      } catch {
                        /* ignore */
                      }
                      return null;
                    })()
                  : null;
                return (
                  <li key={i} className="text-xs">
                    <a
                      href={t.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-casino-text hover:text-casino-gold hover:underline line-clamp-2"
                    >
                      {t.title || t.description}
                    </a>
                    {timeAgo && (
                      <span className="block mt-0.5 text-casino-gray-dark text-[11px]" title={t.pubDate}>
                        {timeAgo}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
