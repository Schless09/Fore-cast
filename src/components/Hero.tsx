'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

/**
 * Hero section with animated background.
 */
export function Hero() {
  const { isSignedIn } = useUser();
  return (
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden">
      {/* Overlay */}
      <div className="absolute inset-0 bg-linear-to-br from-casino-bg/90 via-casino-elevated/88 to-casino-bg/90" />
      
      {/* Animated casino lights effect */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-casino-gold/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-casino-green/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 text-center space-y-6 py-16">
        <div className="space-y-5">
          <div className="inline-block">
            <p className="text-sm sm:text-base tracking-[0.3em] uppercase text-casino-gold font-bold shimmer">
              Fantasy Golf • Compete with Friends
            </p>
          </div>
          
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-black font-orbitron">
            <span className="block bg-linear-to-r from-casino-gold via-casino-gold-light to-casino-gold bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]">
              FORE!SIGHT
            </span>
          </h1>

          {/* One-line descriptor replacing "Predict • Play • Win" */}
          <p className="text-lg sm:text-xl md:text-2xl font-semibold text-casino-text/90 tracking-wide">
            Fantasy golf scored by <span className="text-casino-green">real PGA Tour prize money</span>
          </p>
          
          <p className="text-base sm:text-lg text-casino-gray max-w-2xl mx-auto leading-relaxed">
            Pick up to 10 golfers each week under a <span className="text-casino-green font-bold">$30 cap</span>. Your score is the real prize money they win on tour. Compete in a private <span className="text-casino-gold font-bold">league</span> with friends—create one or join with an invite link.
          </p>
        </div>

        {/* Stat row — replaces the vague badges */}
        <div className="flex items-center justify-center gap-6 sm:gap-10 py-2">
          <div className="text-center">
            <p className="text-2xl sm:text-3xl font-black font-orbitron text-casino-gold">$30</p>
            <p className="text-xs text-casino-gray uppercase tracking-widest mt-0.5">Salary Cap</p>
          </div>
          <div className="w-px h-8 bg-casino-gold/20" />
          <div className="text-center">
            <p className="text-2xl sm:text-3xl font-black font-orbitron text-casino-green">10</p>
            <p className="text-xs text-casino-gray uppercase tracking-widest mt-0.5">Max Golfers</p>
          </div>
          <div className="w-px h-8 bg-casino-gold/20" />
          <div className="text-center">
            <p className="text-2xl sm:text-3xl font-black font-orbitron text-casino-gold">Top 4</p>
            <p className="text-xs text-casino-gray uppercase tracking-widest mt-0.5">Paid Weekly</p>
          </div>
        </div>

        {/* CTAs — primary is visually dominant; secondary is clearly subordinate */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isSignedIn ? (
            <Link href="/tournaments" className="w-full sm:w-auto">
              <button className="btn-casino-gold w-full sm:w-auto px-12 py-4 text-lg rounded-xl font-bold tracking-wide shadow-[0_0_24px_rgba(251,191,36,0.35)] hover:shadow-[0_0_36px_rgba(251,191,36,0.5)] transition-all">
                ⭐ This Week&apos;s Tourney
              </button>
            </Link>
          ) : (
            <Link href="/auth/signup" className="w-full sm:w-auto">
              <button className="btn-casino-gold w-full sm:w-auto px-12 py-4 text-lg rounded-xl font-bold tracking-wide shadow-[0_0_24px_rgba(251,191,36,0.35)] hover:shadow-[0_0_36px_rgba(251,191,36,0.5)] transition-all">
                🏌️ Join a League
              </button>
            </Link>
          )}
          <Link href={isSignedIn ? "/leagues" : "/create-league"} className="w-full sm:w-auto">
            <button className="w-full sm:w-auto px-10 py-4 text-base rounded-xl font-medium border border-white/20 text-white/70 hover:border-white/40 hover:text-white/90 transition-all backdrop-blur-sm">
              {isSignedIn ? "My Leagues" : "Create Your Own League"}
            </button>
          </Link>
        </div>

        {/* Quick-links as scannable pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <Link href="/masters" className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#006747]/20 border border-[#00a86b]/30 text-[#00a86b] text-sm font-medium hover:bg-[#006747]/30 hover:border-[#00a86b]/50 transition-all">
            🏆 The Masters
          </Link>
          <Link href="/majors" className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-casino-gold/10 border border-casino-gold/30 text-casino-gold/90 text-sm font-medium hover:bg-casino-gold/20 hover:border-casino-gold/50 transition-all">
            ⛳ Majors Pool
          </Link>
          <Link href="/upcoming-tournaments" className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-casino-gray text-sm font-medium hover:bg-white/10 hover:text-white/80 transition-all">
            📅 Upcoming Tournaments
          </Link>
        </div>
      </div>
    </section>
  );
}
