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
                💰 Season Buy-In: $403
              </h2>
              <p className="text-casino-gray mb-3">
                Payment due before the start of the first tournament
              </p>
              <Link
                href="https://venmo.com/Andrew-Schuessler-2?txn=pay&amount=403&note=Bama%20Boys%20Golf%20%2726%20Buy-in"
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

      {/* Rules Section */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold text-casino-gold mb-4">📋 League Rules</h2>
          
          {/* Weekly Rules */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-2">Weekly Rules</h3>
            <p className="text-casino-gray">
              Using your budget of <span className="text-casino-green font-semibold">$30</span>, select up to <span className="text-casino-green font-semibold">10 golfers</span> each week. 
              The person whose team of golfers earns the most money for that tournament wins the week.
            </p>
          </div>

          {/* Weekly Payouts */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-2">Weekly Payouts</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-casino-dark/50 border border-casino-gold/20 rounded-lg p-3 text-center">
                <div className="text-casino-gold font-bold">1st</div>
                <div className="text-white text-lg">45%</div>
              </div>
              <div className="bg-casino-dark/50 border border-casino-gold/20 rounded-lg p-3 text-center">
                <div className="text-casino-gold font-bold">2nd</div>
                <div className="text-white text-lg">30%</div>
              </div>
              <div className="bg-casino-dark/50 border border-casino-gold/20 rounded-lg p-3 text-center">
                <div className="text-casino-gold font-bold">3rd</div>
                <div className="text-white text-lg">15%</div>
              </div>
              <div className="bg-casino-dark/50 border border-casino-gold/20 rounded-lg p-3 text-center">
                <div className="text-casino-gold font-bold">4th</div>
                <div className="text-white text-lg">10%</div>
              </div>
            </div>
          </div>

          {/* FedEx Cup */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-2">🏆 FedEx Cup Playoffs</h3>
            <div className="bg-casino-dark/30 border border-casino-gold/10 rounded-lg p-4 mb-3">
              <p className="text-casino-gray text-sm">
                <span className="text-casino-gold">⚠️ Important:</span> All players (qualified & eliminated) should set a lineup during FedEx Cup weeks 
                as you&apos;re still eligible to win the weekly contest & season prize. This is essentially our playoff where you &quot;do well & advance&quot;. 
                Top half of the field advances each week.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-casino-dark/50 border border-casino-gold/20 rounded-lg p-3">
                <div className="text-casino-gold font-bold text-sm">FedEx St Jude</div>
                <div className="text-casino-gray text-xs mt-1">All members</div>
              </div>
              <div className="bg-casino-dark/50 border border-casino-gold/20 rounded-lg p-3">
                <div className="text-casino-gold font-bold text-sm">BMW Championship</div>
                <div className="text-casino-gray text-xs mt-1">Top 24</div>
              </div>
              <div className="bg-casino-dark/50 border border-casino-gold/20 rounded-lg p-3">
                <div className="text-casino-gold font-bold text-sm">Tour Championship</div>
                <div className="text-casino-gray text-xs mt-1">Top 12</div>
              </div>
            </div>
          </div>

          {/* Season Payouts */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">💵 Season Payouts</h3>
            <p className="text-casino-gray text-sm mb-3">Based on total combined prize money</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-casino-dark/50 border border-casino-gold/20 rounded-lg p-3">
                <div className="text-casino-gold font-bold">1st Half</div>
                <div className="text-casino-gray text-sm">Genesis → PGA Championship</div>
              </div>
              <div className="bg-casino-dark/50 border border-casino-gold/20 rounded-lg p-3">
                <div className="text-casino-gold font-bold">2nd Half</div>
                <div className="text-casino-gray text-sm">Charles Schwab → BMW Championship</div>
              </div>
              <div className="bg-casino-dark/50 border border-casino-gold/20 rounded-lg p-3">
                <div className="text-casino-gold font-bold">Full Season</div>
                <div className="text-casino-gray text-sm">Total $$ accumulated</div>
              </div>
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
