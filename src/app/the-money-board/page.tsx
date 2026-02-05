import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/Card';
import Image from 'next/image';
import Link from 'next/link';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = {
  title: 'The Money Board',
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

async function getLeagueSettings(): Promise<{ settings: LeagueSettings | null; leagueName: string | null }> {
  const { userId } = await auth();
  
  if (!userId) {
    return { settings: null, leagueName: null };
  }

  const supabase = createServiceClient();
  
  // Get the user's profile to find their active league
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_league_id')
    .eq('clerk_id', userId)
    .single();

  if (!profile?.active_league_id) {
    return { settings: null, leagueName: null };
  }

  // Get the league settings
  const { data: league } = await supabase
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
    .single();

  return { 
    settings: league as LeagueSettings | null, 
    leagueName: league?.name || null 
  };
}

export default async function TheMoneyBoardPage() {
  const { settings, leagueName } = await getLeagueSettings();

  // Check if any money board settings are configured
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
          The Money Board
        </h1>
        {leagueName && (
          <p className="text-casino-gray">{leagueName}</p>
        )}
      </div>

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

      {/* Rules Section */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold text-casino-gold mb-4">📋 League Rules</h2>
          
          <div className="space-y-3 text-sm">
            {/* Weekly - Fixed platform rules */}
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-white font-medium">Weekly:</span>
              <span className="text-casino-gray">$30 budget, up to 10 golfers. Most prize money wins.</span>
            </div>

            {/* Payouts - from settings or default */}
            {settings?.payout_description ? (
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-white font-medium">Payouts:</span>
                <span className="text-casino-gold">{settings.payout_description}</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-casino-gray">Payouts:</span>
                <span className="text-casino-gold">1st 45%</span>
                <span className="text-casino-gray">•</span>
                <span className="text-casino-gold">2nd 30%</span>
                <span className="text-casino-gray">•</span>
                <span className="text-casino-gold">3rd 15%</span>
                <span className="text-casino-gray">•</span>
                <span className="text-casino-gold">4th 10%</span>
                <span className="text-casino-gray text-xs ml-1">(Default)</span>
              </div>
            )}

            {/* FedEx */}
            <div>
              <span className="text-white font-medium">FedEx Cup:</span>
              <span className="text-casino-gray ml-2">All members → Top 24 → Top 12.</span>
              <Link href="/fedex" className="text-casino-gold hover:underline ml-1">Playoff rules →</Link>
            </div>

            {/* Season */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-casino-gold/10">
              <span className="text-white font-medium">Season Standings:</span>
              <Link href="/standings/season?period=first" className="text-casino-gold hover:underline">1st Half</Link>
              <span className="text-casino-gray">•</span>
              <Link href="/standings/season?period=second" className="text-casino-gold hover:underline">2nd Half</Link>
              <span className="text-casino-gray">•</span>
              <Link href="/standings/season?period=full" className="text-casino-gold hover:underline">Full Season</Link>
            </div>
          </div>
        </CardContent>
      </Card>

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
                    title="The Money Board"
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
    </div>
  );
}
