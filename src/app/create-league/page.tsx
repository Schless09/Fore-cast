import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'Create a League',
  description:
    'Become a commissioner and run your own fantasy golf league. $1 per member ($10 min). Lineup management, live scoring, and leaderboards. You handle payouts—we provide the platform.',
};

export default function CreateLeaguePage() {
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
          Create Your Own League
        </h1>
        <p className="text-xl text-casino-gray mb-10">
          Run a fantasy golf league for friends, family, or coworkers. You&apos;re the commissioner—we provide the platform.
        </p>

        <div className="mb-8 p-6 bg-casino-gold/10 border border-casino-gold/30 rounded-xl">
          <p className="text-lg font-semibold text-casino-gold mb-1">Platform pricing</p>
          <p className="text-casino-text">
            $1 per league member, $10 minimum. A 5-person league is $10; a 15-person league is $15.
          </p>
        </div>

        <div className="space-y-6 mb-12">
          <Card className="bg-casino-card/90 border border-casino-gold/20">
            <CardHeader>
              <CardTitle>What we provide</CardTitle>
            </CardHeader>
            <CardContent className="text-casino-text space-y-3">
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-casino-gold mt-0.5">✓</span>
                  <span><strong>Lineup management</strong> — Members draft PGA Tour pros under a $30 salary cap</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-casino-gold mt-0.5">✓</span>
                  <span><strong>Live scoring</strong> — Real-time updates as tournaments play out</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-casino-gold mt-0.5">✓</span>
                  <span><strong>Weekly & season leaderboards</strong> — Rosters scored by PGA Tour winnings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-casino-gold mt-0.5">✓</span>
                  <span><strong>Invite links</strong> — Easy way to add members with a password</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-casino-card/90 border border-casino-gold/20">
            <CardHeader>
              <CardTitle>Your role as commissioner</CardTitle>
            </CardHeader>
            <CardContent className="text-casino-text space-y-3">
              <p>
                <strong>You handle the money.</strong> FORE!SIGHT never takes custody of entry fees or payouts. 
                You collect from members (e.g., Venmo, cash) and distribute winnings yourself. We&apos;re a 
                tracking tool—like a scorekeeping app for your league.
              </p>
              <p className="text-casino-gray text-sm">
                We charge $1 per league member ($10 min) for platform access. We provide software for 
                private fantasy leagues; you run your league.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-casino-card/90 border border-casino-gold/20">
            <CardHeader>
              <CardTitle>Getting started</CardTitle>
            </CardHeader>
            <CardContent className="text-casino-text space-y-3">
              <ol className="list-decimal list-inside space-y-2">
                <li>Sign up for an account</li>
                <li>Create your league (name + password)</li>
                <li>Invite members with your league link</li>
                <li>Pick which PGA tournaments to include</li>
                <li>Collect entry fees and run payouts on your own—we&apos;ll show the standings</li>
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Link href="/auth/signup">
            <button className="px-12 py-5 rounded-2xl bg-linear-to-r from-casino-gold to-casino-gold-light text-black text-lg font-bold hover:scale-105 transition">
              Create Your League →
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
