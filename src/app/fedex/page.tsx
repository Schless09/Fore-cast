import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'FedEx Cup Playoffs - Fantasy Golf',
  description:
    'Fantasy golf FedEx Cup playoff rules: survive and advance. Weekly fantasy golf lineups still active.',
};

export default function FedExPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-casino-black via-slate-950 to-casino-black">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <Link
          href="/the-club-house"
          className="text-casino-gold hover:text-casino-gold-light mb-6 inline-block text-sm"
        >
          ← Back
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-casino-gold mb-2">
            FedEx Cup Playoffs
          </h1>
          <p className="text-casino-gray text-lg">
            Survive and advance
          </p>
        </div>

        <Card className="bg-casino-card border-casino-gold/20 mb-6">
          <CardContent className="p-6">
            <div className="bg-casino-gold/10 border border-casino-gold/30 rounded-lg px-4 py-3 mb-8">
              <p className="text-casino-text text-center font-medium">
                <span className="text-casino-gold">Everyone sets a lineup every playoff week.</span>
                <br />
                <span className="text-casino-gray text-sm">The weekly contest is still active—1st/2nd/3rd/4th place payouts apply each week. Advancement (Top 24 → Top 12 → Top 4 payouts) is separate.</span>
              </p>
            </div>

            <p className="text-casino-text text-center mb-8">
              The playoffs work in three stages. Only the top finishers advance to the next tournament. Final playoff payouts go to the top 4 at the BMW.
            </p>

            <div className="space-y-8">
              {/* Stage 1: Wyndham */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-casino-gold/20 border-2 border-casino-gold flex items-center justify-center text-casino-gold font-bold">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-casino-gold mb-1">Wyndham Championship</h3>
                  <p className="text-casino-text">
                    Everyone in the league sets a lineup. All teams are in the field. Weekly payouts (1st–4th) apply.
                  </p>
                  <p className="text-casino-green font-medium mt-2">
                    Top 24 advance to FedEx St Jude
                  </p>
                </div>
              </div>

              <div className="border-l-2 border-casino-gold/30 ml-6 h-6" />

              {/* Stage 2: FedEx St Jude */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-casino-gold/20 border-2 border-casino-gold flex items-center justify-center text-casino-gold font-bold">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-casino-gold mb-1">FedEx St Jude Championship</h3>
                  <p className="text-casino-text">
                    Everyone still sets a lineup—weekly contest is active. Only the top 24 from Wyndham advance in the playoff bracket.
                  </p>
                  <p className="text-casino-green font-medium mt-2">
                    Top 12 advance to the BMW Championship
                  </p>
                </div>
              </div>

              <div className="border-l-2 border-casino-gold/30 ml-6 h-6" />

              {/* Stage 3: BMW */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-casino-gold/20 border-2 border-casino-gold flex items-center justify-center text-casino-gold font-bold">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-casino-gold mb-1">BMW Championship</h3>
                  <p className="text-casino-text">
                    Everyone still sets a lineup—weekly contest is active. Only the top 12 from FedEx St Jude are in the playoff bracket.
                  </p>
                  <p className="text-casino-green font-medium mt-2">
                    Top 4 receive playoff payouts
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Link href="/the-club-house">
            <Button variant="outline" className="border-casino-gold text-casino-gold hover:bg-casino-gold/10">
              Back to The Club House
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
