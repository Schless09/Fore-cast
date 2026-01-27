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
            <div className="flex-shrink-0">
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
