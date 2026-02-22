import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Upcoming Tournaments',
  description:
    'PGA Tour fantasy golf schedule. See upcoming tournaments you can compete in with your league.',
};

export const dynamic = 'force-dynamic';

export default async function UpcomingTournamentsPage() {
  const supabase = createServiceClient();

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, start_date, end_date, status, course')
    .in('status', ['upcoming', 'active'])
    .order('start_date', { ascending: true })
    .limit(12);

  const upcoming = (tournaments || []).filter((t) => t.status === 'upcoming');
  const active = (tournaments || []).filter((t) => t.status === 'active');

  return (
    <div className="min-h-screen bg-linear-to-b from-[#0a0f1a] via-[#111827] to-[#0a0f1a]">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center text-casino-gold hover:text-casino-gold/80 text-sm mb-8 transition-colors"
        >
          ← Back to home
        </Link>

        <h1 className="text-4xl sm:text-5xl font-bold font-orbitron mb-4 bg-linear-to-r from-casino-gold via-casino-gold-light to-casino-gold bg-clip-text text-transparent">
          Upcoming Tournaments
        </h1>
        <p className="text-xl text-casino-gray mb-10">
          PGA Tour events you can compete in with your fantasy golf league.
        </p>

        {active.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-casino-green mb-4">Currently active</h2>
            <ul className="space-y-3">
              {active.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between py-3 px-4 bg-casino-card/80 border border-casino-gold/20 rounded-lg"
                >
                  <div>
                    <span className="font-medium text-casino-text">{t.name}</span>
                    {t.course && (
                      <span className="text-casino-gray text-sm ml-2">— {t.course}</span>
                    )}
                  </div>
                  <span className="text-casino-green text-sm font-medium">Live</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {upcoming.length > 0 ? (
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-casino-gold mb-4">
              {active.length > 0 ? 'Next up' : 'Coming soon'}
            </h2>
            <ul className="space-y-3">
              {upcoming.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between py-3 px-4 bg-casino-card/80 border border-casino-gold/20 rounded-lg"
                >
                  <div>
                    <span className="font-medium text-casino-text">{t.name}</span>
                    {t.course && (
                      <span className="text-casino-gray text-sm ml-2">— {t.course}</span>
                    )}
                  </div>
                  <span className="text-casino-gray text-sm">
                    {formatDate(t.start_date)} – {formatDate(t.end_date)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-casino-gray mb-12">No upcoming tournaments scheduled.</p>
        )}

        <div className="text-center space-y-4">
          <p className="text-casino-text">Ready to compete? Join or create a league.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup">
              <button className="px-10 py-4 rounded-xl bg-linear-to-r from-casino-gold to-casino-gold-light text-black font-bold hover:scale-105 transition">
                Join a League →
              </button>
            </Link>
            <Link href="/create-league">
              <button className="px-10 py-4 rounded-xl border-2 border-casino-gold text-casino-gold font-bold hover:bg-casino-gold/10 transition">
                Create Your Own League →
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
