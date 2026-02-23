import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'The Masters | Fantasy Golf League',
  description:
    "Get your league ready for The Masters. Create a fantasy golf league and compete with friends during golf's most prestigious tournament at Augusta National.",
};

export default function MastersPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] font-sans overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">

        {/* Layered atmospheric background */}
        <div className="absolute inset-0">
          {/* Augusta green radial burst */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(0,103,71,0.18)_0%,transparent_65%)]" />
          {/* Secondary softer green orb */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(0,168,107,0.07)_0%,transparent_70%)]" />
          {/* Noise grain */}
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: '200px 200px',
            }}
          />
          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-[#0d1117]" />
        </div>

        {/* Decorative top rule */}
        <div className="absolute top-8 left-0 right-0 opacity-20">
          <div className="h-px bg-gradient-to-r from-transparent via-[#00a86b]/60 to-transparent" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-24 sm:pt-24 sm:pb-32 text-center">

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="h-px w-12 bg-[#00a86b]/50" />
            <p className="text-[#00a86b] font-semibold tracking-[0.35em] uppercase text-xs">
              April at Augusta National
            </p>
            <div className="h-px w-12 bg-[#00a86b]/50" />
          </div>

          {/* Main headline */}
          <h1 className="text-6xl sm:text-7xl md:text-[90px] font-bold font-orbitron leading-none mb-6 tracking-tight">
            <span className="text-white/90 text-4xl sm:text-5xl md:text-6xl tracking-[0.15em] font-light block mb-3">
              THE
            </span>
            <span className="bg-[linear-gradient(135deg,#006747_0%,#00c47a_40%,#006747_70%,#004d33_100%)] bg-clip-text text-transparent drop-shadow-[0_0_60px_rgba(0,168,107,0.3)]">
              MASTERS
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-white/70 max-w-2xl mx-auto mb-4 leading-relaxed">
            The green jacket. Amen Corner. The most iconic week in golf.
          </p>
          <p className="text-base sm:text-lg text-white/50 max-w-xl mx-auto mb-12 leading-relaxed">
            Don&apos;t just watch — compete. Create your fantasy league and put
            your roster to the test at Augusta.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/create-league">
              <button className="group relative px-10 py-4 rounded-xl bg-[#006747] hover:bg-[#007a54] text-white font-bold text-base tracking-wide overflow-hidden transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(0,168,107,0.4)]">
                <span className="relative z-10">Create Your Masters League →</span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-200" />
              </button>
            </Link>
            <Link href="/auth/signup">
              <button className="px-10 py-4 rounded-xl border border-[#006747]/50 text-[#00a86b]/90 font-semibold text-base tracking-wide hover:border-[#00a86b] hover:bg-[#006747]/10 transition-all duration-200">
                Join a League
              </button>
            </Link>
          </div>

        </div>
      </div>

      {/* ── STAT BAR ─────────────────────────────────────────────── */}
      <div className="border-y border-[#006747]/20 bg-[#006747]/8">
        <div className="max-w-5xl mx-auto px-4 py-5 grid grid-cols-3 divide-x divide-[#006747]/20">
          {[
            { value: '4', label: 'Days of Play' },
            { value: '$2', label: 'Per Player' },
            { value: '🟢', label: 'Green Jacket' },
          ].map((stat) => (
            <div key={stat.label} className="px-4 text-center">
              <p className="text-2xl sm:text-3xl font-bold font-orbitron text-[#00a86b]">{stat.value}</p>
              <p className="text-xs text-white/40 uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── WHY A MASTERS LEAGUE ─────────────────────────────────── */}
      <div className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(0,103,71,0.05)_0%,transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-4">

          <div className="text-center mb-12">
            <p className="text-[#00a86b]/60 uppercase tracking-[0.3em] text-xs mb-3">The Case For It</p>
            <h2 className="text-3xl sm:text-4xl font-bold font-orbitron text-white">Why Run a Masters League?</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                icon: '🏌️',
                title: "Everyone's Watching",
                body: "The one tournament casual fans and diehards both tune into. Maximum buy-in from your group without any convincing.",
              },
              {
                icon: '👑',
                title: 'Best Field in Golf',
                body: 'Scottie, Rory, Rahm, Bryson, and more. Simply the best players in the world.',
              },  
              {
                icon: '⚡',
                title: 'Live Every Shot',
                body: 'Real-time updates on every birdie at 12, every eagle at 15. Watch your fantasy leaderboard shift in real time all weekend.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="relative p-7 rounded-2xl bg-white/[0.03] border border-[#006747]/20 hover:border-[#00a86b]/35 hover:bg-white/[0.05] transition-all duration-300 group"
              >
                <div className="text-4xl mb-5 group-hover:scale-110 transition-transform duration-200 inline-block">{item.icon}</div>
                <h3 className="text-base font-bold text-[#00a86b] mb-3 tracking-wide">{item.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AUGUSTA MOMENTS ──────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-10 pb-20">
        <div className="text-center mb-12">
          <p className="text-[#00a86b]/60 uppercase tracking-[0.3em] text-xs mb-3">The Course</p>
          <h2 className="text-3xl sm:text-4xl font-bold font-orbitron text-white">Augusta&apos;s Greatest Stages</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {[
            {
              number: '12',
              name: 'Golden Bell',
              desc: 'The most treacherous par-3 in major championship golf. One wrong club and the tournament is over.',
              color: 'from-[#006747] to-[#00a86b]',
              borderColor: 'border-[#00a86b]/30',
            },
            {
              number: '13',
              name: 'Azalea',
              desc: "Amen Corner's crown jewel. A reachable par-5 that can make or break a champion on Sunday.",
              color: 'from-[#004d33] to-[#006747]',
              borderColor: 'border-[#006747]/30',
            },
            {
              number: '15',
              name: 'Firethorn',
              desc: 'Where eagles happen and galleries erupt. The most electric par-5 in tournament golf.',
              color: 'from-[#006747] to-[#008f5a]',
              borderColor: 'border-[#008f5a]/30',
            },
            {
              number: '18',
              name: 'Holly',
              desc: "Up the hill, through the pines. Sunday on 18 at Augusta is the most iconic walk in golf.",
              color: 'from-[#005a3d] to-[#007a54]',
              borderColor: 'border-[#007a54]/30',
            },
          ].map((hole) => (
            <div
              key={hole.number}
              className={`group relative p-7 rounded-2xl bg-white/[0.03] border ${hole.borderColor} hover:bg-white/[0.06] transition-all duration-300 overflow-hidden`}
            >
              {/* Large background hole number */}
              <div className={`absolute -right-3 -top-4 text-[110px] font-bold font-orbitron bg-gradient-to-br ${hole.color} bg-clip-text text-transparent opacity-10 leading-none select-none`}>
                {hole.number}
              </div>
              {/* Top gradient line */}
              <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${hole.color} opacity-60`} />

              <div className="relative">
                <p className={`text-xs font-semibold uppercase tracking-[0.25em] mb-2 bg-gradient-to-r ${hole.color} bg-clip-text text-transparent`}>
                  Hole {hole.number}
                </p>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">{hole.name}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{hole.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden py-10 pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(0,103,71,0.04)_0%,transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-[#00a86b]/60 uppercase tracking-[0.3em] text-xs mb-3">Simple Setup</p>
            <h2 className="text-3xl sm:text-4xl font-bold font-orbitron text-white">Run It in Minutes</h2>
          </div>

          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-[#00a86b]/40 via-[#00a86b]/20 to-transparent hidden sm:block" />

            <div className="space-y-5">
              {[
                { step: '01', title: 'Create Your League', body: 'Set your league name, choose The Masters as your tournament, and set your entry fee.' },
                { step: '02', title: 'Invite Your Crew', body: 'Share your link. Each player pays $2 to enter. You collect the buy-ins and handle the payout.' },
                { step: '03', title: 'Everyone Drafts a Roster', body: 'Each player picks their lineup from the Masters field under the $30 salary cap. Strategy wins.' },
                { step: '04', title: 'Watch the Magic Happen', body: 'Live scoring updates all weekend. Every shot at Augusta moves your fantasy leaderboard in real time.' },
              ].map((item) => (
                <div key={item.step} className="flex gap-6 items-start p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-[#006747]/30 hover:bg-white/[0.04] transition-all duration-300">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-[#006747]/15 border border-[#006747]/40 flex items-center justify-center">
                    <span className="text-[#00a86b] font-bold font-orbitron text-xs">{item.step}</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                    <p className="text-white/45 text-sm leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── COMMISSIONER SPREADSHEET ─────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-10 pb-20">
        <div className="text-center mb-8">
          <p className="text-[#00a86b]/60 uppercase tracking-[0.3em] text-xs mb-3">Commissioner Tools</p>
          <h2 className="text-3xl sm:text-4xl font-bold font-orbitron text-white mb-4">Example Payout Spreadsheet</h2>
          <p className="text-white/45 max-w-xl mx-auto text-sm leading-relaxed">
            Track buy-ins, payouts, and net per player. Click to open in Google Sheets and make a copy for your league.
          </p>
        </div>

        <div className="rounded-2xl overflow-hidden border border-[#006747]/30 shadow-[0_0_60px_rgba(0,103,71,0.1)]">
          <div className="h-1 bg-gradient-to-r from-[#006747]/60 via-[#00a86b] to-[#006747]/60" />
          <iframe
            src="https://docs.google.com/spreadsheets/d/e/2PACX-1vTO4bBXP5Fnj4_V8k_fJX25DoBSkjrCnccGsndw6e1xX0EB634otYJSor_HdfYpx22znHdjdbk10FKz/pubhtml?widget=true&headers=false"
            className="w-full h-[400px] sm:h-[500px] bg-[#0d1117]"
            title="FORE!SIGHT Commissioner Cheat Sheet (Masters)"
          />
          <a
            href="https://docs.google.com/spreadsheets/d/1Rq8gAYXP3u4tmtTQkclI9IFakDzxSTRssqglL5Y5q0U/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-4 px-4 bg-[#006747]/10 hover:bg-[#006747]/20 text-[#00a86b] font-semibold text-sm transition-colors"
          >
            <span>Open in Google Sheets</span>
            <span>→</span>
          </a>
        </div>
      </div>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 pb-24">
        <div className="relative rounded-3xl overflow-hidden border border-[#006747]/30 p-12 sm:p-16 text-center">
          {/* Background glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,103,71,0.18)_0%,transparent_65%)]" />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00a86b] to-transparent" />

          <div className="relative">
            <p className="text-[#00a86b]/60 uppercase tracking-[0.3em] text-xs mb-4">Ready to Go?</p>
            <h3 className="text-3xl sm:text-4xl font-bold font-orbitron text-white mb-4">
              Run the League.<br />
              <span className="bg-[linear-gradient(135deg,#006747,#00c47a,#006747)] bg-clip-text text-transparent">
                Earn the Jacket.
              </span>
            </h3>
            <p className="text-white/50 mb-10 max-w-lg mx-auto leading-relaxed">
              Create your Masters league, invite your crew, and let Augusta do the rest.
              $2 per member ($20 min). You handle payouts — we handle the scoring.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/create-league">
                <button className="group relative px-12 py-5 rounded-2xl bg-[#006747] hover:bg-[#007a54] text-white text-base font-bold transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(0,168,107,0.35)]">
                  Create Your Masters League →
                </button>
              </Link>
              <Link href="/auth/signup">
                <button className="px-12 py-5 rounded-2xl border-2 border-[#006747]/40 text-[#00a86b]/90 font-bold hover:bg-[#006747]/10 hover:border-[#006747] transition-all duration-200">
                  Join a League
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER NAV ───────────────────────────────────────────── */}
      <div className="border-t border-white/5 py-10">
        <p className="text-center flex items-center justify-center gap-4 text-sm">
          <Link href="/majors" className="text-white/35 hover:text-[#00a86b] transition-colors">
            Majors Pool →
          </Link>
          <span className="text-white/20">·</span>
          <Link href="/" className="text-white/35 hover:text-[#00a86b] transition-colors">
            ← Back to FORE!SIGHT
          </Link>
        </p>
      </div>

    </div>
  );
}