import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'The Masters | Fantasy Golf League',
  description:
    'Get your league ready for the Masters. Create a fantasy golf league and compete with friends during golf\'s most prestigious tournament at Augusta National.',
};

export default function MastersPage() {
  return (
    <div className="min-h-screen bg-[#0a1a0f]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,#0a1a0f_70%)]" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 bg-[#006747]/30 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 py-20 sm:py-28 text-center">
          <p className="text-[#006747] font-semibold tracking-[0.3em] uppercase text-sm mb-4">
            April at Augusta
          </p>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold font-orbitron mb-6">
            <span className="text-white">The </span>
            <span className="bg-[linear-gradient(135deg,#006747_0%,#00a86b_50%,#006747_100%)] bg-clip-text text-transparent">
              Masters
            </span>
          </h1>
          <p className="text-xl sm:text-2xl text-casino-gray max-w-2xl mx-auto mb-4">
            Golf&apos;s most prestigious week. The green jacket. Amen Corner. 
            The best field in the world at the most iconic course.
          </p>
          <p className="text-lg text-casino-gray/90 max-w-xl mx-auto">
            Don&apos;t just watch—compete. Create a fantasy golf league and see who on your roster 
            brings home the jacket.
          </p>
        </div>
      </div>

      {/* Why now */}
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8 text-center">
          Why run a Masters league?
        </h2>
        <div className="grid sm:grid-cols-3 gap-6 mb-16">
          <div className="p-6 rounded-xl bg-white/5 border border-[#006747]/30">
            <p className="text-3xl mb-3">🏌️</p>
            <h3 className="font-semibold text-[#00a86b] mb-2">Everyone&apos;s Watching</h3>
            <p className="text-casino-gray text-sm">
              The one tournament every golf fan tunes into. Perfect moment to get your group engaged.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-white/5 border border-[#006747]/30">
            <p className="text-3xl mb-3">👑</p>
            <h3 className="font-semibold text-[#00a86b] mb-2">Best Field in Golf</h3>
            <p className="text-casino-gray text-sm">
              Scottie, Rory, Rahm, Tiger—your league drafts from the actual Masters field.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-white/5 border border-[#006747]/30">
            <p className="text-3xl mb-3">📊</p>
            <h3 className="font-semibold text-[#00a86b] mb-2">Live Leaderboard</h3>
            <p className="text-casino-gray text-sm">
              Track rosters in real time. Every birdie on 12, every eagle on 15—it all counts.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center p-10 sm:p-14 rounded-2xl bg-[#006747]/20 border-2 border-[#006747]/40">
          <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to run a Masters league?
          </h3>
          <p className="text-casino-gray mb-8 max-w-xl mx-auto">
            Create your league in minutes. Invite friends, set your lineup, and compete for the green jacket.
            $1 per member ($10 min). You handle payouts—we handle scoring.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/create-league">
              <button className="px-12 py-5 rounded-2xl bg-[#006747] hover:bg-[#005a3d] text-white text-lg font-bold transition">
                Create Your Masters League →
              </button>
            </Link>
            <Link href="/auth/signup">
              <button className="px-12 py-5 rounded-2xl border-2 border-[#006747] text-[#00a86b] font-bold hover:bg-[#006747]/20 transition">
                Join a League
              </button>
            </Link>
          </div>
        </div>

        <p className="text-center mt-10">
          <Link href="/" className="text-casino-gray hover:text-[#00a86b] text-sm transition-colors">
            ← Back to FORE!SIGHT
          </Link>
        </p>
      </div>
    </div>
  );
}
