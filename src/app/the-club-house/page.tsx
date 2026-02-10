import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/Card';
import Image from 'next/image';
import Link from 'next/link';
import { HowItWorks } from '@/components/HowItWorks';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = {
  title: 'The Club House',
  description:
    'Fantasy golf league rules, payouts, and payment info. Prize money and Venmo for FORE!SIGHT fantasy golf leagues.',
};

interface LeagueSettings {
  id: string;
  name: string;
  google_sheet_url: string | null;
  google_sheet_embed_url: string | null;
  buy_in_amount: number | null;
  venmo_username: string | null;
  venmo_qr_image_path: string | null;
  payment_instructions: string | null;
  payout_description: string | null;
}

interface SegmentDefinition {
  number: number;
  name: string;
}

async function getLeagueSettings(): Promise<{
  settings: LeagueSettings | null;
  leagueName: string | null;
  segments: SegmentDefinition[];
}> {
  const { userId } = await auth();
  
  if (!userId) {
    return { settings: null, leagueName: null, segments: [] };
  }

  const supabase = createServiceClient();
  
  // Get the user's profile to find their active league
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_league_id')
    .eq('clerk_id', userId)
    .single();

  if (!profile?.active_league_id) {
    return { settings: null, leagueName: null, segments: [] };
  }

  // Get the league settings and segments in parallel
  const [leagueResult, segmentsResult] = await Promise.all([
    supabase
      .from('leagues')
      .select(`
        id,
        name,
        google_sheet_url,
        google_sheet_embed_url,
        buy_in_amount,
        venmo_username,
        venmo_qr_image_path,
        payment_instructions,
        payout_description
      `)
      .eq('id', profile.active_league_id)
      .single(),
    supabase
      .from('league_segments')
      .select('segment_number, name')
      .eq('league_id', profile.active_league_id)
      .order('segment_number', { ascending: true }),
  ]);

  const league = leagueResult.data;
  const segmentRows = segmentsResult.data || [];

  const segments: SegmentDefinition[] = segmentRows.map((s) => ({
    number: s.segment_number,
    name: s.name,
  }));

  return { 
    settings: league as LeagueSettings | null, 
    leagueName: league?.name || null,
    segments,
  };
}

export default async function TheClubHousePage() {
  const { settings, leagueName, segments } = await getLeagueSettings();

  // Check if any club house settings are configured
  const hasPaymentInfo = settings && (
    settings.buy_in_amount || 
    settings.venmo_username || 
    settings.venmo_qr_image_path
  );
  
  const hasGoogleSheet = settings && (
    settings.google_sheet_url || 
    settings.google_sheet_embed_url
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          The Club House
        </h1>
        {leagueName && (
          <p className="text-casino-gray">{leagueName}</p>
        )}
      </div>

      <HowItWorks payoutDescription={settings?.payout_description} segmentDefinitions={segments} />

      {/* Venmo Payment Section */}
      {hasPaymentInfo ? (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Venmo QR Code */}
              {settings.venmo_qr_image_path && (
                <div className="shrink-0">
                  <Image
                    src={settings.venmo_qr_image_path}
                    alt="Venmo QR Code"
                    width={150}
                    height={150}
                    className="rounded-lg"
                  />
                </div>
              )}
              
              {/* Payment Info */}
              <div className="text-center md:text-left">
                {settings.buy_in_amount && (
                  <h2 className="text-xl font-bold text-casino-gold mb-2">
                    💰 Season Buy-In: ${settings.buy_in_amount}
                  </h2>
                )}
                {settings.payment_instructions && (
                  <p className="text-casino-gray mb-3">
                    {settings.payment_instructions}
                  </p>
                )}
                {settings.venmo_username && settings.buy_in_amount && (
                  <Link
                    href={`https://venmo.com/${settings.venmo_username.replace('@', '')}?txn=pay&amount=${settings.buy_in_amount}&note=${encodeURIComponent(leagueName || 'League Buy-In')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#008CFF] hover:bg-[#0074D4] text-white font-semibold rounded-lg transition-colors"
                  >
                    Pay via Venmo {settings.venmo_username}
                  </Link>
                )}
                {settings.venmo_username && !settings.buy_in_amount && (
                  <p className="text-casino-gray">
                    Venmo: <span className="text-casino-gold">{settings.venmo_username}</span>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="text-center py-4">
              <p className="text-casino-gray">
                No payment information configured for this league.
              </p>
              <p className="text-casino-gray text-sm mt-2">
                Contact your league commissioner for payment details.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Google Sheet */}
      {hasGoogleSheet ? (
        <Card>
          <CardContent className="pt-6">
            {settings.google_sheet_url && (
              <div className="mb-4 flex justify-end">
                <Link
                  href={settings.google_sheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-casino-gold hover:text-casino-gold/80 underline"
                >
                  Open in Google Sheets ↗
                </Link>
              </div>
            )}
            {settings.google_sheet_embed_url ? (
              <div className="w-full overflow-hidden" style={{ height: '600px' }}>
                <div style={{ 
                  transform: 'scale(0.75)', 
                  transformOrigin: 'top left',
                  width: '133.33%',
                  height: '133.33%'
                }}>
                  <iframe 
                    src={settings.google_sheet_embed_url}
                    className="w-full h-full border-0 rounded"
                    title="The Club House"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-casino-gray">
                  No spreadsheet embed configured.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-casino-gray">
                No spreadsheet configured for this league.
              </p>
              <p className="text-casino-gray text-sm mt-2">
                The league commissioner can set this up in the league settings.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kumu Map - Only for Bama Boys 2026 */}
      {leagueName === 'Bama Boys 2026' && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold text-casino-gold mb-4">
              League Network Map
            </h2>
            <div className="w-full overflow-hidden rounded-lg">
              <iframe 
                src="https://embed.kumu.io/e8502628fd65baaf25a0015efc395fdf" 
                width="940" 
                height="600" 
                className="w-full border-0"
                title="League Network Map"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
