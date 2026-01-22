'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import { Hero } from '@/components/Hero';
import { Card, CardContent } from '@/components/ui/Card';

function AuthCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code');

  useEffect(() => {
    // If there's a code parameter, redirect to the auth callback handler
    if (code) {
      logger.info('Redirecting to auth callback', { hasCode: !!code });
      router.push(`/auth/callback?code=${code}`);
    }
  }, [code, router]);

  return null;
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <Suspense fallback={null}>
        <AuthCallbackHandler />
      </Suspense>
      <Hero />

      <main className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold bg-linear-to-r from-casino-gold to-casino-gold-light bg-clip-text text-transparent mb-3">
            How It Works
          </h2>
          <p className="text-[#9ca3af] text-lg">
            Three simple steps to start winning
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="group hover:scale-105 transition-transform duration-300">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-6 transform group-hover:scale-110 transition-transform">
                🏌️
              </div>
              <h3 className="text-2xl font-bold bg-linear-to-r from-casino-gold to-casino-gold-light bg-clip-text text-transparent mb-4">
                Build Your Roster
              </h3>
              <p className="text-[#9ca3af] leading-relaxed">
                Select up to <span className="text-casino-green font-semibold">10 PGA Tour players</span> and 
                stay under the <span className="text-casino-gold font-semibold">$30 salary cap</span>. Every dollar counts!
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:scale-105 transition-transform duration-300">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-6 transform group-hover:scale-110 transition-transform">
                📊
              </div>
              <h3 className="text-2xl font-bold bg-linear-to-r from-casino-gold to-casino-gold-light bg-clip-text text-transparent mb-4">
                Track Live Scores
              </h3>
              <p className="text-[#9ca3af] leading-relaxed">
                Watch your team climb the <span className="text-casino-green font-semibold">real-time leaderboard</span>. 
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:scale-105 transition-transform duration-300">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-6 transform group-hover:scale-110 transition-transform">
                🏆
              </div>
              <h3 className="text-2xl font-bold bg-linear-to-r from-casino-gold to-casino-gold-light bg-clip-text text-transparent mb-4">
                Win Prize Money
              </h3>
              <p className="text-[#9ca3af] leading-relaxed">
                Your score is based on <span className="text-casino-gold font-semibold">actual PGA prize money</span>. 
                Top the leaderboard and claim victory!
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <div className="card-elevated p-8 max-w-3xl mx-auto">
            <p className="text-casino-gold font-bold text-sm tracking-wider uppercase mb-3">Casino-Style Gaming</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#e8eaed] mb-4">
              Weekly Tournaments. Real Competition. Big Prizes.
            </h3>
            <p className="text-[#9ca3af] text-lg mb-6">
              Join thousands of players competing for weekly glory and season championships. 
              Make your picks weekly before the golfers tee off.
            </p>
            <button className="btn-casino-gold px-8 py-3 rounded-lg text-lg font-bold">
              Join the Action →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

