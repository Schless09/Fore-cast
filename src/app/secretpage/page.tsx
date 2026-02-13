import { createServiceClient } from '@/lib/supabase/service';
import Link from 'next/link';
import { ESPNCompareTable } from '@/components/secretpage/ESPNCompareTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CachedPlayer {
  player?: string;
  playerId?: string;
  position?: string;
  positionValue?: number;
  total?: string | number;
  thru?: string;
  currentRoundScore?: string | number;
}

export default async function SecretComparePage() {
  const supabase = createServiceClient();

  // Get active or next upcoming tournament (with rapidapi or espn id)
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, status, start_date, rapidapi_tourn_id, espn_event_id')
    .in('status', ['active', 'upcoming'])
    .order('start_date', { ascending: true })
    .limit(5);

  const tournament = tournaments?.[0];

  if (!tournament) {
    return (
      <div className="min-h-screen bg-casino-dark text-casino-text p-8">
        <h1 className="text-2xl font-bold text-casino-gold mb-4">RapidAPI vs ESPN Comparison</h1>
        <p className="text-casino-gray">No active or upcoming tournament found.</p>
        <Link href="/tournaments" className="text-casino-gold hover:underline mt-4 inline-block">
          ← Tournaments
        </Link>
      </div>
    );
  }

  // Fetch both caches by tournament_id
  const { data: rapidApiCache } = await supabase
    .from('live_scores_cache')
    .select('data, updated_at')
    .eq('tournament_id', tournament.id)
    .single();

  const { data: espnCache } = await supabase
    .from('espn_cache')
    .select('data, updated_at')
    .eq('tournament_id', tournament.id)
    .single();

  const rapidApiPlayers = (rapidApiCache?.data?.data || []) as CachedPlayer[];
  const espnPlayers = (espnCache?.data?.data || []) as CachedPlayer[];

  return (
    <div className="min-h-screen bg-casino-dark text-casino-text p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-casino-gold">
            RapidAPI vs ESPN — {tournament.name}
          </h1>
          <Link href="/tournaments" className="text-casino-gold hover:underline">
            ← Tournaments
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* RapidAPI */}
          <div className="bg-casino-card border border-casino-gold/20 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-casino-gold mb-2">
              RapidAPI (live_scores_cache)
            </h2>
            <p className="text-xs text-casino-gray mb-4">
              Updated: {rapidApiCache?.updated_at
                ? new Date(rapidApiCache.updated_at).toLocaleString()
                : 'never'}
            </p>
            <p className="text-sm text-casino-gray mb-2">{rapidApiPlayers.length} players</p>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-casino-gold/30 text-left text-casino-gray uppercase text-xs">
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Total</th>
                    <th className="px-2 py-2">Today</th>
                    <th className="px-2 py-2">Thru</th>
                  </tr>
                </thead>
                <tbody>
                  {rapidApiPlayers.map((p, i) => (
                    <tr key={i} className="border-b border-casino-gold/10">
                      <td className="px-2 py-1.5">{p.positionValue ?? p.position ?? '-'}</td>
                      <td className="px-2 py-1.5">{p.player ?? 'Unknown'}</td>
                      <td className="px-2 py-1.5">{String(p.total ?? '-')}</td>
                      <td className="px-2 py-1.5">{p.currentRoundScore != null ? String(p.currentRoundScore) : '-'}</td>
                      <td className="px-2 py-1.5">{p.thru ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ESPN */}
          <ESPNCompareTable
            players={espnPlayers}
            updatedAt={espnCache?.updated_at ?? null}
            espnEventId={tournament.espn_event_id ?? null}
          />
        </div>

        <p className="text-xs text-casino-gray">
          Tournament: {tournament.name} • RapidAPI ID: {tournament.rapidapi_tourn_id ?? '—'} • ESPN ID: {tournament.espn_event_id ?? '—'}
          <br />
          Set espn_event_id in admin for tournaments you want to compare.
          <br />
          ESPN sync runs every 2 min • RapidAPI sync runs every 4 min (during active tournament windows).
        </p>
      </div>
    </div>
  );
}
