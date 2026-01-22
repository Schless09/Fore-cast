'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

/**
 * Hero section with animated background.
 */
export function Hero() {
  return (
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-br from-casino-bg via-casino-elevated/95 to-casino-bg" />
      
      {/* Animated casino lights effect */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-casino-gold/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-casino-green/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 text-center space-y-8 py-16">
        <div className="space-y-6">
          <div className="inline-block">
            <p className="text-sm sm:text-base tracking-[0.3em] uppercase text-casino-gold font-bold shimmer">
              Fantasy Golf • Real Stakes
            </p>
          </div>
          
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-black font-orbitron">
            <span className="block bg-linear-to-r from-casino-gold via-casino-gold-light to-casino-gold bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]">
              FORE!CAST
            </span>
          </h1>
          
          <div className="flex items-center justify-center gap-4 text-2xl sm:text-3xl md:text-4xl font-bold text-casino-text">
            <span className="text-casino-gold" style={{ textShadow: '0 0 20px rgba(251, 191, 36, 0.5), 0 0 40px rgba(251, 191, 36, 0.3)' }}>Predict</span>
            <span className="text-casino-gold/50">•</span>
            <span className="text-casino-green" style={{ textShadow: '0 0 20px rgba(16, 185, 129, 0.5), 0 0 40px rgba(16, 185, 129, 0.3)' }}>Play</span>
            <span className="text-casino-green/50">•</span>
            <span className="text-casino-blue" style={{ textShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)' }}>Win</span>
          </div>
          
          <p className="text-base sm:text-lg md:text-xl text-casino-gray max-w-3xl mx-auto leading-relaxed">
            Build your PGA roster under the <span className="text-casino-green font-bold">$30 salary cap</span>, 
            track live scoring, and compete for <span className="text-casino-gold font-bold">real prize money</span> positions.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
          <Link href="/auth" className="w-full sm:w-auto">
            <button className="btn-casino-gold w-full sm:w-auto px-10 py-4 text-lg rounded-xl font-bold tracking-wide">
              🏌️ Start Playing
            </button>
          </Link>
          <Link href="/tournaments" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto px-10 py-4 text-lg rounded-xl font-semibold border-2 border-casino-gold text-casino-gold hover:bg-casino-gold/10 transition-all backdrop-blur-sm">
              View Tournaments
            </button>
          </Link>
        </div>
        
        <div className="pt-8 flex items-center justify-center gap-8 text-sm text-casino-gray">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-casino-green rounded-full live-indicator" />
            <span>Live Scoring</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-casino-gold">⚡</span>
            <span>Real-Time Updates</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-casino-green">💰</span>
            <span>Prize Money</span>
          </div>
        </div>
      </div>
    </section>
  );
}

