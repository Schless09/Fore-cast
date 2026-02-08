import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';

interface SegmentDefinition {
  number: number;
  name: string;
}

interface HowItWorksProps {
  payoutDescription?: string | null;
  segmentDefinitions?: SegmentDefinition[];
}

export function HowItWorks({ payoutDescription, segmentDefinitions = [] }: HowItWorksProps) {
  return (
    <Card className="mb-6 border-casino-gold/20">
      <CardContent className="pt-6">
        <h2 className="text-xl font-bold text-casino-gold mb-4">How It Works</h2>
        
        <div className="space-y-3 text-sm text-casino-text">
          {/* Weekly */}
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-white font-medium">Weekly:</span>
            <span className="text-casino-gray">
              $30 budget, up to 10 golfers. Your team earns the purse won by each player on your roster—most total prize money wins. Rosters open <span className="text-casino-gold font-medium">Monday around noon CST</span> and lock when the tournament starts.
            </span>
          </div>

          {/* Payouts */}
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-white font-medium">Payouts:</span>
            {payoutDescription ? (
              <span className="text-casino-gold">{payoutDescription}</span>
            ) : (
              <>
                <span className="text-casino-gold">1st 45%</span>
                <span className="text-casino-gray">·</span>
                <span className="text-casino-gold">2nd 30%</span>
                <span className="text-casino-gray">·</span>
                <span className="text-casino-gold">3rd 15%</span>
                <span className="text-casino-gray">·</span>
                <span className="text-casino-gold">4th 10%</span>
                <span className="text-casino-gray text-xs ml-1">(Default)</span>
              </>
            )}
          </div>

          {/* FedEx */}
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-white font-medium">FedEx Cup:</span>
            <span className="text-casino-gray">All members → Top 24 → Top 12.</span>
            <Link href="/fedex" className="text-casino-gold hover:underline">Playoff rules →</Link>
          </div>

          {/* Season */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-casino-gold/10">
            <span className="text-white font-medium">Season:</span>
            {segmentDefinitions.length > 0 ? (
              <>
                {segmentDefinitions.map((seg) => (
                  <span key={seg.number} className="contents">
                    <Link
                      href={`/standings/season?period=${seg.number === 1 ? 'first' : seg.number === 2 ? 'second' : seg.number}`}
                      className="text-casino-gold hover:underline"
                    >
                      {seg.name}
                    </Link>
                    <span className="text-casino-gray">·</span>
                  </span>
                ))}
                <Link href="/standings/season?period=full" className="text-casino-gold hover:underline">Full Season</Link>
              </>
            ) : (
              <>
                <Link href="/standings/season?period=first" className="text-casino-gold hover:underline">1st Half</Link>
                <span className="text-casino-gray">·</span>
                <Link href="/standings/season?period=second" className="text-casino-gold hover:underline">2nd Half</Link>
                <span className="text-casino-gray">·</span>
                <Link href="/standings/season?period=full" className="text-casino-gold hover:underline">Full Season</Link>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-casino-gold/10 flex flex-wrap gap-3">
          <Link href="/tournaments" className="text-casino-gold hover:underline text-sm font-medium">
            Tournaments →
          </Link>
          <Link href="/standings/weekly" className="text-casino-gold hover:underline text-sm font-medium">
            Weekly Standings →
          </Link>
          <Link href="/standings/season" className="text-casino-gold hover:underline text-sm font-medium">
            Season Standings →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
