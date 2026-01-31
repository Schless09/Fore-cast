import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import PlayerStatsToggle from '@/components/players/PlayerStatsToggle';

interface PlayerProfilePageProps {
  params: { id: string };
  searchParams: { tournament?: string; venue?: string };
}

export default async function PlayerProfilePage({
  params,
  searchParams,
}: PlayerProfilePageProps) {
  const { id } = params;
  const supabase = await createClient();

  // Fetch player info
  const { data: player, error: playerError } = await supabase
    .from('pga_players')
    .select('*')
    .eq('id', id)
    .single();

  if (playerError || !player) {
    notFound();
  }

  // Fetch last 20 events
  const { data: recentResults } = await supabase
    .from('historical_tournament_results')
    .select('*')
    .eq('pga_player_id', id)
    .order('tournament_date', { ascending: false })
    .limit(20);

  // Fetch venue history if venue_id provided
  let venueResults = null;
  if (searchParams.venue) {
    const { data } = await supabase
      .from('historical_tournament_results')
      .select('*')
      .eq('pga_player_id', id)
      .eq('venue_id', searchParams.venue)
      .order('tournament_date', { ascending: false });
    venueResults = data;
  }

  // Get current tournament info if provided
  let tournamentInfo = null;
  if (searchParams.tournament) {
    const { data } = await supabase
      .from('tournaments')
      .select('name, course')
      .eq('id', searchParams.tournament)
      .single();
    tournamentInfo = data;
  }

  // Generate flag emoji
  function getCountryFlag(countryCode: string | null): string {
    if (!countryCode) return '';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Link href={searchParams.tournament ? `/tournaments/${searchParams.tournament}` : '/players'}>
            <Button variant="ghost" size="sm" className="text-white mb-4">
              ← Back
            </Button>
          </Link>
        </div>

        {/* Player Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-4">
              {player.image_url && (
                <img
                  src={player.image_url}
                  alt={player.name}
                  className="w-20 h-20 rounded-full"
                />
              )}
              <div>
                <CardTitle className="text-3xl flex items-center gap-2">
                  {player.name}
                  {player.country && (
                    <span className="text-2xl" title={player.country}>
                      {getCountryFlag(player.country)}
                    </span>
                  )}
                </CardTitle>
                <div className="flex gap-4 mt-2 text-sm text-gray-600">
                  {player.world_ranking && (
                    <span>World Rank: <strong>#{player.world_ranking}</strong></span>
                  )}
                  {player.fedex_cup_ranking && (
                    <span>FedEx Cup: <strong>#{player.fedex_cup_ranking}</strong></span>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Toggle Component */}
        <PlayerStatsToggle
          recentResults={recentResults || []}
          venueResults={venueResults || []}
          venueName={tournamentInfo?.course || searchParams.venue || null}
        />
      </div>
    </div>
  );
}
