'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { logger } from '@/lib/logger';
import { Hero } from '@/components/Hero';
import { IPhone17Frame } from '@/components/IPhone17Frame';

function AuthCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code');

  useEffect(() => {
    if (code) {
      logger.info('Redirecting to auth callback', { hasCode: !!code });
      router.push(`/auth/callback?code=${code}`);
    }
  }, [code, router]);

  return null;
}

export default function Home() {
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          document.documentElement.style.setProperty(
            '--scroll-y',
            `${window.scrollY}`
          );
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f1a] via-[#111827] to-[#0a0f1a] overflow-x-hidden">
      <Suspense fallback={null}>
        <AuthCallbackHandler />
      </Suspense>

      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-casino-gold/4 rounded-full blur-3xl motion-safe:animate-soft-pulse"
          style={{ transform: 'translateY(calc(var(--scroll-y) * 0.06))' }}
        />
        <div
          className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-casino-green/4 rounded-full blur-3xl motion-safe:animate-soft-pulse"
          style={{ transform: 'translateY(calc(var(--scroll-y) * 0.08))' }}
        />
        <div
          className="absolute bottom-0 left-1/2 w-[700px] h-[700px] bg-casino-gold/3 rounded-full blur-3xl motion-safe:animate-soft-pulse"
          style={{ transform: 'translateY(calc(var(--scroll-y) * -0.03))' }}
        />

        <div
          className="absolute inset-0 opacity-[0.01]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(234,179,8,0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(234,179,8,0.08) 1px, transparent 1px)
            `,
            backgroundSize: '120px 120px',
            transform: 'translateY(calc(var(--scroll-y) * 0.1))'
          }}
        />
      </div>

      <Hero />

      <main className="relative w-full max-w-7xl mx-auto px-4 py-16 lg:py-20">
        {/* Header */}
        <div className="text-center mb-14 lg:mb-20">
          <span className="inline-block mb-5 text-casino-gold text-sm tracking-[0.3em] uppercase px-6 py-3 bg-casino-gold/10 rounded-full border border-casino-gold/20">
            Simple • Strategic • Rewarding
          </span>

          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-5">
            <span className="bg-gradient-to-r from-white via-casino-gold-light to-casino-gold bg-clip-text text-transparent">
              How It Works
            </span>
          </h2>

          <p className="text-gray-400 text-xl sm:text-2xl max-w-3xl mx-auto">
            Three simple steps to dominate the leaderboard
          </p>
        </div>

        {/* Step 1 */}
        <section className="relative grid lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-10 lg:mb-16">
          <div>
            <h3 className="text-4xl sm:text-5xl font-bold mb-5 bg-gradient-to-r from-white to-casino-gold bg-clip-text text-transparent">
              Build Your Dream Roster
            </h3>
            <p className="text-gray-400 text-lg sm:text-xl mb-6">
              Draft PGA Tour pros under $30 salary cap and outsmart the field.
            </p>
          </div>

          <div className="relative z-20 lg:-mb-24">
            <IPhone17Frame
              src="/roster.png"
              alt="Roster screen"
              scale={0.7}
              animate
            />
          </div>
        </section>

        {/* Step 2 */}
        <section className="relative grid lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-10 lg:mb-16">
          <div className="relative z-20 lg:-mb-24 order-last lg:order-first">
            <IPhone17Frame
              src="/leaderboard2.png"
              alt="Leaderboard"
              scale={0.7}
              animate
            />
          </div>

          <div>
            <h3 className="text-4xl sm:text-5xl font-bold mb-5 bg-gradient-to-r from-white to-casino-green bg-clip-text text-transparent">
              Track Live Scores
            </h3>
            <p className="text-gray-400 text-lg sm:text-xl mb-6">
              Every birdie and bogey updates in real time.
            </p>
          </div>
        </section>

        {/* Step 3 */}
        <section className="relative grid lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-10 lg:mb-16">
          <div>
            <h3 className="text-4xl sm:text-5xl font-bold mb-5 bg-gradient-to-r from-white to-casino-gold bg-clip-text text-transparent">
              Claim Victory
            </h3>
            <p className="text-gray-400 text-lg sm:text-xl mb-6">
              Win based on real PGA prize money and weekly tournaments.
            </p>
          </div>

          <div className="relative z-10">
            <IPhone17Frame
              src="/standings2.png"
              alt="Standings"
              scale={0.7}
              animate
            />
          </div>
        </section>

        {/* CTA */}
        <div className="relative max-w-5xl mx-auto text-center mt-10 lg:mt-16">
          <div className="absolute inset-0 bg-gradient-to-r from-casino-gold/10 via-casino-green/10 to-casino-gold/10 rounded-3xl blur-3xl" />

          <div className="relative p-12 lg:p-14 bg-[#0f1419]/90 border border-casino-gold/20 rounded-3xl backdrop-blur-xl">
            <h3 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-casino-gold bg-clip-text text-transparent">
              Ready to Play?
            </h3>

            <p className="text-gray-400 text-lg sm:text-xl mb-8">
              Lock your picks before the first tee shot.
            </p>

            <Link href="/auth/signup">
              <button className="px-12 py-5 rounded-2xl bg-gradient-to-r from-casino-gold to-casino-gold-light text-black text-lg font-bold hover:scale-105 transition">
                Start Playing →
              </button>
            </Link>
          </div>
        </div>
      </main>

      {/* Animations */}
      <style jsx global>{`
        @keyframes soft-pulse {
          0% {
            opacity: 0.55;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.02);
          }
          100% {
            opacity: 0.55;
            transform: scale(1);
          }
        }

        .animate-soft-pulse {
          animation: soft-pulse 7s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
