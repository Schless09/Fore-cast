import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Majors Pool | Fantasy Golf League',
  description:
    "Run a fantasy golf pool for all four majors. Masters, PGA Championship, U.S. Open, The Open—compete with friends across golf's biggest events.",
};

export default function MajorsPage() {
  const majors = [
    {
      name: 'The Masters',
      month: 'April',
      venue: 'Augusta National Golf Club, Augusta, GA',
      number: '01',
      color: 'from-[#006747] to-[#00a86b]',
      borderColor: 'border-[#00a86b]/40',
      glowColor: 'shadow-[#006747]/30',
      badge: 'Green Jacket',
    },
    {
      name: 'PGA Championship',
      month: 'May',
      venue: 'Aronimink Golf Club, Newtown Square, PA',
      number: '02',
      color: 'from-amber-800 to-amber-500',
      borderColor: 'border-amber-500/40',
      glowColor: 'shadow-amber-700/30',
      badge: 'Wanamaker Trophy',
    },
    {
      name: 'U.S. Open',
      month: 'June',
      venue: 'Shinnecock Hills Golf Club, Southampton, NY',
      number: '03',
      color: 'from-slate-600 to-slate-300',
      borderColor: 'border-slate-400/40',
      glowColor: 'shadow-slate-500/30',
      badge: 'U.S. Open Trophy',
    },
    {
      name: 'The Open',
      month: 'July',
      venue: 'Royal Birkdale Golf Club, Southport, England',
      number: '04',
      color: 'from-sky-800 to-sky-400',
      borderColor: 'border-sky-400/40',
      glowColor: 'shadow-sky-700/30',
      badge: 'Claret Jug',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] font-sans overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">

        {/* Layered atmospheric background */}
        <div className="absolute inset-0">
          {/* Radial gold burst behind headline */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.12)_0%,transparent_65%)]" />
          {/* Noise grain overlay */}
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

        {/* Decorative horizontal rule lines */}
        <div className="absolute top-8 left-0 right-0 flex flex-col gap-px opacity-20">
          <div className="h-px bg-gradient-to-r from-transparent via-casino-gold/60 to-transparent" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-24 sm:pt-24 sm:pb-32 text-center">

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="h-px w-12 bg-casino-gold/50" />
            <p className="text-casino-gold font-semibold tracking-[0.35em] uppercase text-xs">
              The Four Biggest Weeks in Golf
            </p>
            <div className="h-px w-12 bg-casino-gold/50" />
          </div>

          {/* Main headline */}
          <h1 className="text-6xl sm:text-7xl md:text-[90px] font-bold font-orbitron leading-none mb-6 tracking-tight">
            <span className="bg-[linear-gradient(135deg,#fbbf24_0%,#fef3c7_40%,#fbbf24_70%,#d97706_100%)] bg-clip-text text-transparent drop-shadow-[0_0_60px_rgba(251,191,36,0.25)]">
              MAJORS
            </span>
            <br />
            <span className="text-white/90 text-4xl sm:text-5xl md:text-6xl tracking-[0.15em] font-light">
              POOL
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-white/70 max-w-2xl mx-auto mb-4 leading-relaxed">
            Masters | PGA | U.S. Open | The Open
          </p>
          <p className="text-base sm:text-lg text-white/50 max-w-xl mx-auto mb-12 leading-relaxed">
            Four majors. One pool. Draft before each event, climb the leaderboard all season.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/create-league">
              <button className="group relative px-10 py-4 rounded-xl bg-casino-gold text-black font-bold text-base tracking-wide overflow-hidden transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(251,191,36,0.4)]">
                <span className="relative z-10">Create Your Majors Pool →</span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-200" />
              </button>
            </Link>
            <Link href="/auth/signup">
              <button className="px-10 py-4 rounded-xl border border-casino-gold/40 text-casino-gold/90 font-semibold text-base tracking-wide hover:border-casino-gold hover:bg-casino-gold/10 transition-all duration-200">
                Join a League
              </button>
            </Link>
          </div>

        </div>
      </div>

      {/* ── STAT BAR ─────────────────────────────────────────────── */}
      <div className="border-y border-casino-gold/15 bg-casino-gold/5">
        <div className="max-w-5xl mx-auto px-4 py-5 grid grid-cols-3 divide-x divide-casino-gold/15">
          {[
            { value: '4', label: 'Majors' },
            { value: '$2', label: 'Site Fee per Player' },
            { value: '∞', label: 'Bragging Rights' },
          ].map((stat) => (
            <div key={stat.label} className="px-4 text-center">
              <p className={`font-bold font-orbitron text-casino-gold ${stat.value === '∞' ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'}`}>{stat.value}</p>
              <p className="text-xs text-white/40 uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOUR MAJORS CARDS ────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <p className="text-casino-gold/60 uppercase tracking-[0.3em] text-xs mb-3">The Lineup</p>
          <h2 className="text-3xl sm:text-4xl font-bold font-orbitron text-white">Four Shots at Glory</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {majors.map((major) => (
            <div
              key={major.name}
              className={`group relative p-7 rounded-2xl bg-white/[0.03] border ${major.borderColor} hover:bg-white/[0.06] hover:shadow-xl ${major.glowColor} transition-all duration-300 overflow-hidden`}
            >
              {/* Large background number */}
              <div className={`absolute -right-3 -top-4 text-[110px] font-bold font-orbitron bg-gradient-to-br ${major.color} bg-clip-text text-transparent opacity-10 leading-none select-none`}>
                {major.number}
              </div>

              {/* Subtle top gradient line */}
              <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${major.color} opacity-60`} />

              <div className="relative">
                <p className={`text-xs font-semibold uppercase tracking-[0.25em] mb-2 bg-gradient-to-r ${major.color} bg-clip-text text-transparent`}>
                  {major.month}
                </p>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">{major.name}</h3>
                <p className="text-white/40 text-sm mb-4">{major.venue}</p>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${major.borderColor} bg-white/5`}>
                  <span className="text-xs text-white/50">🏆</span>
                  <span className="text-xs text-white/60 font-medium">{major.badge}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

   

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <p className="text-casino-gold/60 uppercase tracking-[0.3em] text-xs mb-3">Simple Setup</p>
          <h2 className="text-3xl sm:text-4xl font-bold font-orbitron text-white">Run It in Minutes</h2>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-casino-gold/40 via-casino-gold/20 to-transparent hidden sm:block" />

          <div className="space-y-5">
            {[
              { step: '01', title: 'Create Your League', body: 'Set your league name, choose which majors to include, and set your entry fee.' },
              { step: '02', title: 'Invite Your Crew', body: 'Share a link. Each player pays $2 to enter. You collect, you pay out.' },
              { step: '03', title: 'Draft Before Each Major', body: 'Every player builds their roster under the $30 salary cap before each event.' },
              { step: '04', title: 'Watch It Play Out', body: 'Live scoring updates automatically. Season standings track cumulative performance.' },
            ].map((item) => (
              <div key={item.step} className="flex gap-6 items-start p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-casino-gold/20 hover:bg-white/[0.04] transition-all duration-300">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-casino-gold/10 border border-casino-gold/30 flex items-center justify-center">
                  <span className="text-casino-gold font-bold font-orbitron text-xs">{item.step}</span>
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

      {/* ── COMMISSIONER SPREADSHEET ─────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-10 pb-20">
        <div className="text-center mb-8">
          <p className="text-casino-gold/60 uppercase tracking-[0.3em] text-xs mb-3">Commissioner Tools</p>
          <h2 className="text-3xl sm:text-4xl font-bold font-orbitron text-white mb-4">Example Payout Spreadsheet</h2>
          <p className="text-white/45 max-w-xl mx-auto text-sm leading-relaxed">
            Track buy-ins, payouts, and net per player. Click to open in Google Sheets and make a copy for your league.
          </p>
        </div>

        <div className="rounded-2xl overflow-hidden border border-casino-gold/20 shadow-[0_0_60px_rgba(251,191,36,0.08)]">
          <div className="h-1 bg-gradient-to-r from-casino-gold/60 via-casino-gold to-casino-gold/60" />
          <iframe
            src="https://docs.google.com/spreadsheets/d/e/2PACX-1vTO4bBXP5Fnj4_V8k_fJX25DoBSkjrCnccGsndw6e1xX0EB634otYJSor_HdfYpx22znHdjdbk10FKz/pubhtml?widget=true&headers=false"
            className="w-full h-[400px] sm:h-[500px] bg-[#0d1117]"
            title="FORE!SIGHT Commissioner Cheat Sheet (Majors)"
          />
          <a
            href="https://docs.google.com/spreadsheets/d/1Rq8gAYXP3u4tmtTQkclI9IFakDzxSTRssqglL5Y5q0U/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-4 px-4 bg-casino-gold/10 hover:bg-casino-gold/20 text-casino-gold font-semibold text-sm transition-colors"
          >
            <span>Open in Google Sheets</span>
            <span>→</span>
          </a>
        </div>
      </div>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 pb-24">
        <div className="relative rounded-3xl overflow-hidden border border-casino-gold/25 p-12 sm:p-16 text-center">
          {/* Background glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(251,191,36,0.12)_0%,transparent_65%)]" />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-casino-gold to-transparent" />

          <div className="relative">
            <p className="text-casino-gold/60 uppercase tracking-[0.3em] text-xs mb-4">Ready to Go?</p>
            <h3 className="text-3xl sm:text-4xl font-bold font-orbitron text-white mb-4">
              Run the Pool.<br />
              <span className="bg-[linear-gradient(135deg,#fbbf24,#fef3c7,#fbbf24)] bg-clip-text text-transparent">
                Own the Season.
              </span>
            </h3>
            <p className="text-white/50 mb-10 max-w-lg mx-auto leading-relaxed">
              Create your league, pick your majors, and invite your crew.
              $2 per member ($20 min). You handle payouts — we handle the scoring.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/create-league">
                <button className="group relative px-12 py-5 rounded-2xl bg-casino-gold hover:bg-amber-400 text-black text-base font-bold transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(251,191,36,0.45)]">
                  Create Your Majors Pool →
                </button>
              </Link>
              <Link href="/auth/signup">
                <button className="px-12 py-5 rounded-2xl border-2 border-casino-gold/40 text-casino-gold/90 font-bold hover:bg-casino-gold/10 hover:border-casino-gold transition-all duration-200">
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
          <Link href="/masters" className="text-white/35 hover:text-casino-gold transition-colors">
            The Masters →
          </Link>
          <span className="text-white/20">·</span>
          <Link href="/" className="text-white/35 hover:text-casino-gold transition-colors">
            ← Back to FORE!SIGHT
          </Link>
        </p>
      </div>

    </div>
  );
}
