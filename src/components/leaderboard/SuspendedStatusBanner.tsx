'use client';

interface SuspendedStatusBannerProps {
  /** When true, shows the suspended banner with link to @PGATOURComms */
  isSuspended: boolean;
  /** Optional status detail from ESPN (e.g. "Round 1 - Suspended") */
  statusDetail?: string | null;
}

export function SuspendedStatusBanner({ isSuspended, statusDetail }: SuspendedStatusBannerProps) {
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
          <p className="mt-2 text-xs text-casino-gray">
            <a
              href="https://x.com/PGATOURComms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-casino-gold hover:underline"
            >
              Latest from @PGATOURComms on X →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
