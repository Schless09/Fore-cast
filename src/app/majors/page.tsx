import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Majors Pool | Fantasy Golf League',
  description:
    'Run a fantasy golf pool for all four majors. Masters, PGA Championship, U.S. Open, The Open—compete with friends across golf\'s biggest events.',
};

export default function MajorsPage() {
  const majors = [
    { name: 'The Masters', month: 'April', venue: 'Augusta National', color: 'from-[#006747] to-[#00a86b]' },
    { name: 'PGA Championship', month: 'May', venue: 'Rotates', color: 'from-amber-700 to-amber-500' },
    { name: 'U.S. Open', month: 'June', venue: 'Rotates', color: 'from-slate-600 to-slate-400' },
    { name: 'The Open', month: 'July', venue: 'Rotates (UK)', color: 'from-sky-700 to-sky-500' },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(251,191,36,0.08)_0%,transparent_50%,#0d1117_100%)]" />
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-casino-gold/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-casino-gold/15 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 py-20 sm:py-28 text-center">
          <p className="text-casino-gold font-semibold tracking-[0.3em] uppercase text-sm mb-4">
            The Four Biggest Weeks in Golf
          </p>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold font-orbitron mb-6">
            <span className="bg-[linear-gradient(135deg,#fbbf24_0%,#fef3c7_50%,#fbbf24_100%)] bg-clip-text text-transparent">
              Majors Pool
            </span>
          </h1>
          <p className="text-xl sm:text-2xl text-casino-gray max-w-2xl mx-auto mb-4">
            Masters. PGA. U.S. Open. The Open. Four tournaments. One champion.
          </p>
          <p className="text-lg text-casino-gray/90 max-w-xl mx-auto">
            Run a league that only fires for the majors—lower commitment, maximum stakes. 
            Your group drafts once per major and competes for the biggest trophies in golf.
          </p>
        </div>
      </div>

      {/* The four majors */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-10 text-center">
          The lineup
        </h2>
        <div className="grid sm:grid-cols-2 gap-6 mb-16">
          {majors.map((major, i) => (
            <div
              key={major.name}
              className={`p-6 rounded-xl bg-white/5 border border-casino-gold/20 bg-linear-to-br ${major.color}/10`}
            >
              <p className="text-casino-gold/80 text-sm font-medium mb-1">{major.month}</p>
              <h3 className="text-xl font-bold text-white mb-1">{major.name}</h3>
              <p className="text-casino-gray text-sm">{major.venue}</p>
            </div>
          ))}
        </div>

        {/* Why a majors pool */}
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8 text-center">
          Why a majors-only pool?
        </h2>
        <div className="grid sm:grid-cols-3 gap-6 mb-16">
          <div className="p-6 rounded-xl bg-white/5 border border-casino-gold/20">
            <p className="text-3xl mb-3">📅</p>
            <h3 className="font-semibold text-casino-gold mb-2">Lower Commitment</h3>
            <p className="text-casino-gray text-sm">
              Four events instead of 40+. Perfect for casual fans who still want skin in the game.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-white/5 border border-casino-gold/20">
            <p className="text-3xl mb-3">🏆</p>
            <h3 className="font-semibold text-casino-gold mb-2">Maximum Stakes</h3>
            <p className="text-casino-gray text-sm">
              Every event is a major. Green jacket, Wanamaker, U.S. Open trophy, Claret Jug.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-white/5 border border-casino-gold/20">
            <p className="text-3xl mb-3">📊</p>
            <h3 className="font-semibold text-casino-gold mb-2">Season Standings</h3>
            <p className="text-casino-gray text-sm">
              Aggregate across all four majors or pay out per event. Your call as commissioner.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center p-10 sm:p-14 rounded-2xl bg-casino-gold/10 border-2 border-casino-gold/30">
          <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to run a majors pool?
          </h3>
          <p className="text-casino-gray mb-8 max-w-xl mx-auto">
            Create your league, pick which majors to include, and invite your crew.
            $1 per member ($10 min). You handle payouts—we handle scoring.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/create-league">
              <button className="px-12 py-5 rounded-2xl bg-casino-gold hover:bg-casino-gold/90 text-black text-lg font-bold transition">
                Create Your Majors Pool →
              </button>
            </Link>
            <Link href="/auth/signup">
              <button className="px-12 py-5 rounded-2xl border-2 border-casino-gold text-casino-gold font-bold hover:bg-casino-gold/10 transition">
                Join a League
              </button>
            </Link>
          </div>
        </div>

        <p className="text-center mt-10 flex items-center justify-center gap-4 text-sm">
          <Link href="/masters" className="text-casino-gray hover:text-casino-gold transition-colors">
            The Masters →
          </Link>
          <span className="text-casino-gray/50">·</span>
          <Link href="/" className="text-casino-gray hover:text-casino-gold transition-colors">
            ← Back to FORE!SIGHT
          </Link>
        </p>
      </div>
    </div>
  );
}
