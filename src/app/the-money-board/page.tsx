import { Card, CardContent } from '@/components/ui/Card';
import Image from 'next/image';
import Link from 'next/link';

export default async function TheMoneyBoardPage() {
  // Authentication is handled by Clerk middleware
  // If user gets here, they are authenticated

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          The Money Board
        </h1>
      </div>

      {/* Venmo Payment Section */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Venmo QR Code */}
            <div className="shrink-0">
              <Image
                src="/venmo.jpeg"
                alt="Venmo QR Code"
                width={150}
                height={150}
                className="rounded-lg"
              />
            </div>
            
            {/* Payment Info */}
            <div className="text-center md:text-left">
              <h2 className="text-xl font-bold text-casino-gold mb-2">
                💰 Season Buy-In: $409
              </h2>
              <p className="text-casino-gray mb-3">
                Payment due before the start of the first tournament
              </p>
              <Link
                href="https://venmo.com/Andrew-Schuessler-2?txn=pay&amount=409&note=Bama%20Boys%20Golf%20%2726%20Buy-in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#008CFF] hover:bg-[#0074D4] text-white font-semibold rounded-lg transition-colors"
              >
                Pay via Venmo @Andrew-Schuessler-2
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules Section - Compact */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold text-casino-gold mb-4">📋 League Rules</h2>
          
          <div className="space-y-3 text-sm">
            {/* Weekly */}
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-white font-medium">Weekly:</span>
              <span className="text-casino-gray">$30 budget, up to 10 golfers. Most prize money wins.</span>
              <span className="text-casino-gray">Payouts:</span>
              <span className="text-casino-gold">1st 45%</span>
              <span className="text-casino-gray">•</span>
              <span className="text-casino-gold">2nd 30%</span>
              <span className="text-casino-gray">•</span>
              <span className="text-casino-gold">3rd 15%</span>
              <span className="text-casino-gray">•</span>
              <span className="text-casino-gold">4th 10%</span>
              <span className="text-casino-gray text-xs ml-1">(Top 5 if 50+ members)</span>
            </div>

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
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex justify-end">
            <Link
              href="https://docs.google.com/spreadsheets/d/1UYABcwfn-azoY7YUwyNEk-sUfL8MHupFH1fDr61CG4w/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-casino-gold hover:text-casino-gold/80 underline"
            >
              Open in Google Sheets ↗
            </Link>
          </div>
          <div className="w-full overflow-hidden" style={{ height: '600px' }}>
            <div style={{ 
              transform: 'scale(0.75)', 
              transformOrigin: 'top left',
              width: '133.33%',
              height: '133.33%'
            }}>
              <iframe 
                src="https://docs.google.com/spreadsheets/d/e/2PACX-1vTecKBhuY8WNibIiprccOrj7jXqxouPcK5QgnQphyc_ealkISLSU_co1fuzPID8qnXmz-gVfYFR0ina/pubhtml?gid=2031372717&amp;single=true&amp;widget=true&amp;headers=false"
                className="w-full h-full border-0 rounded"
                title="The Money Board"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
