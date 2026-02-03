// 'use client';

// import { Suspense, useEffect } from 'react';
// import { useSearchParams, useRouter } from 'next/navigation';
// import Link from 'next/link';
// import { logger } from '@/lib/logger';
// import { Hero } from '@/components/Hero';
// import { Card, CardContent } from '@/components/ui/Card';

// function AuthCallbackHandler() {
//   const searchParams = useSearchParams();
//   const router = useRouter();
//   const code = searchParams.get('code');

//   useEffect(() => {
//     // If there's a code parameter, redirect to the auth callback handler
//     if (code) {
//       logger.info('Redirecting to auth callback', { hasCode: !!code });
//       router.push(`/auth/callback?code=${code}`);
//     }
//   }, [code, router]);

//   return null;
// }

// export default function Home() {
//   return (
//     <div className="min-h-screen">
//       <Suspense fallback={null}>
//         <AuthCallbackHandler />
//       </Suspense>
//       <Hero />

//       <main className="max-w-7xl mx-auto px-4 py-20">
//         <div className="text-center mb-12">
//           <h2 className="text-3xl sm:text-4xl font-bold bg-linear-to-r from-casino-gold to-casino-gold-light bg-clip-text text-transparent mb-3">
//             How It Works
//           </h2>
//           <p className="text-[#9ca3af] text-lg">
//             Three simple steps to start winning
//           </p>
//         </div>

//         <div className="grid md:grid-cols-3 gap-8">
//           <Card className="group hover:scale-105 transition-transform duration-300">
//             <CardContent className="p-8 text-center">
//               <div className="text-6xl mb-6 transform group-hover:scale-110 transition-transform">
//                 🏌️
//               </div>
//               <h3 className="text-2xl font-bold bg-linear-to-r from-casino-gold to-casino-gold-light bg-clip-text text-transparent mb-4">
//                 Build Your Roster
//               </h3>
//               <p className="text-[#9ca3af] leading-relaxed">
//                 Select up to <span className="text-casino-green font-semibold">10 PGA Tour players</span> and 
//                 stay under the <span className="text-casino-gold font-semibold">$30 salary cap</span>. Every dollar counts!
//               </p>
//             </CardContent>
//           </Card>

//           <Card className="group hover:scale-105 transition-transform duration-300">
//             <CardContent className="p-8 text-center">
//               <div className="text-6xl mb-6 transform group-hover:scale-110 transition-transform">
//                 📊
//               </div>
//               <h3 className="text-2xl font-bold bg-linear-to-r from-casino-gold to-casino-gold-light bg-clip-text text-transparent mb-4">
//                 Track Live Scores
//               </h3>
//               <p className="text-[#9ca3af] leading-relaxed">
//                 Watch your team climb the <span className="text-casino-green font-semibold">real-time leaderboard</span>. 
//               </p>
//             </CardContent>
//           </Card>

//           <Card className="group hover:scale-105 transition-transform duration-300">
//             <CardContent className="p-8 text-center">
//               <div className="text-6xl mb-6 transform group-hover:scale-110 transition-transform">
//                 🏆
//               </div>
//               <h3 className="text-2xl font-bold bg-linear-to-r from-casino-gold to-casino-gold-light bg-clip-text text-transparent mb-4">
//                 Win Prize Money
//               </h3>
//               <p className="text-[#9ca3af] leading-relaxed">
//                 Your score is based on <span className="text-casino-gold font-semibold">actual PGA prize money</span>. 
//                 Top the leaderboard and claim victory!
//               </p>
//             </CardContent>
//           </Card>
//         </div>

//         <div className="mt-16 text-center">
//           <div className="card-elevated p-8 max-w-3xl mx-auto">
//             <p className="text-casino-gold font-bold text-sm tracking-wider uppercase mb-3">Casino-Style Gaming</p>
//             <h3 className="text-2xl sm:text-3xl font-bold text-[#e8eaed] mb-4">
//               Weekly Tournaments. Real Competition. Big Prizes.
//             </h3>
//             <p className="text-[#9ca3af] text-lg mb-6">
//               Join thousands of players competing for weekly glory and season championships. 
//               Make your picks weekly before the golfers tee off.
//             </p>
//             <Link href="/auth/signup">
//               <button className="btn-casino-gold px-8 py-3 rounded-lg text-lg font-bold">
//                 Join the Action →
//               </button>
//             </Link>
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// }

'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { logger } from '@/lib/logger';
import { Hero } from '@/components/Hero';
import { Card, CardContent } from '@/components/ui/Card';

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
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f1a] via-[#111827] to-[#0a0f1a]">
      <Suspense fallback={null}>
        <AuthCallbackHandler />
      </Suspense>
      
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-casino-gold/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-casino-green/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <Hero />

      <main className="relative max-w-7xl mx-auto px-4 py-24">
        {/* How It Works Section */}
        <div className="text-center mb-16">
          <div className="inline-block mb-4">
            <span className="text-casino-gold font-bold text-sm tracking-widest uppercase px-4 py-2 bg-casino-gold/10 rounded-full border border-casino-gold/20">
              Simple • Strategic • Rewarding
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-white via-casino-gold-light to-casino-gold bg-clip-text text-transparent">
              How It Works
            </span>
          </h2>
          <p className="text-[#9ca3af] text-xl max-w-2xl mx-auto">
            Three simple steps to start your journey to the top of the leaderboard
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-24">
          {/* Step 1 */}
          <Card className="group relative overflow-hidden border-2 border-transparent hover:border-casino-gold/30 transition-all duration-500 hover:shadow-2xl hover:shadow-casino-gold/20">
            <div className="absolute inset-0 bg-gradient-to-br from-casino-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="relative p-10 text-center">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-casino-gold/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative text-7xl transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                  🏌️
                </div>
              </div>
              <div className="inline-block px-3 py-1 bg-casino-gold/10 rounded-full mb-4">
                <span className="text-casino-gold font-bold text-sm">STEP 1</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-white to-casino-gold-light bg-clip-text text-transparent">
                Build Your Dream Roster
              </h3>
              <p className="text-[#9ca3af] leading-relaxed text-lg">
                Draft up to{' '}
                <span className="text-casino-green font-bold px-2 py-0.5 bg-casino-green/10 rounded">
                  10 PGA Tour pros
                </span>
                {' '}while staying under the{' '}
                <span className="text-casino-gold font-bold px-2 py-0.5 bg-casino-gold/10 rounded">
                  $30 salary cap
                </span>
                . Strategy meets skill!
              </p>
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card className="group relative overflow-hidden border-2 border-transparent hover:border-casino-green/30 transition-all duration-500 hover:shadow-2xl hover:shadow-casino-green/20">
            <div className="absolute inset-0 bg-gradient-to-br from-casino-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="relative p-10 text-center">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-casino-green/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative text-7xl transform group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500">
                  📊
                </div>
              </div>
              <div className="inline-block px-3 py-1 bg-casino-green/10 rounded-full mb-4">
                <span className="text-casino-green font-bold text-sm">STEP 2</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-white to-casino-green bg-clip-text text-transparent">
                Track Live Scores
              </h3>
              <p className="text-[#9ca3af] leading-relaxed text-lg">
                Watch your lineup dominate on the{' '}
                <span className="text-casino-green font-bold px-2 py-0.5 bg-casino-green/10 rounded">
                  real-time leaderboard
                </span>
                . Every shot counts, every birdie matters!
              </p>
            </CardContent>
          </Card>

          {/* Step 3 */}
          <Card className="group relative overflow-hidden border-2 border-transparent hover:border-casino-gold/30 transition-all duration-500 hover:shadow-2xl hover:shadow-casino-gold/20">
            <div className="absolute inset-0 bg-gradient-to-br from-casino-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="relative p-10 text-center">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-casino-gold/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative text-7xl transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
                  🏆
                </div>
              </div>
              <div className="inline-block px-3 py-1 bg-casino-gold/10 rounded-full mb-4">
                <span className="text-casino-gold font-bold text-sm">STEP 3</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-white to-casino-gold-light bg-clip-text text-transparent">
                Claim Your Victory
              </h3>
              <p className="text-[#9ca3af] leading-relaxed text-lg">
                Earn based on{' '}
                <span className="text-casino-gold font-bold px-2 py-0.5 bg-casino-gold/10 rounded">
                  real PGA prize money
                </span>
                . Top the board, take home glory!
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-casino-gold/10 via-casino-green/10 to-casino-gold/10 rounded-3xl blur-2xl" />
          <div className="relative card-elevated p-12 max-w-4xl mx-auto border border-casino-gold/20 rounded-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-casino-gold/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-casino-green/5 rounded-full blur-3xl" />
            
            <div className="relative text-center">
            
              
              <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-white via-casino-gold to-casino-green bg-clip-text text-transparent">
                  Weekly Tournaments.<br />Real Competition.<br />Big Prizes.
                </span>
              </h3>
              
              <p className="text-[#9ca3af] text-xl mb-8 max-w-2xl mx-auto leading-relaxed">
                Join thousands of players competing for weekly glory and season championships. 
                Lock in your picks before the first tee shot rings out.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link href="/auth/signup" className="w-full sm:w-auto">
                  <button className="w-full sm:w-auto group relative px-10 py-4 bg-gradient-to-r from-casino-gold to-casino-gold-light rounded-xl text-lg font-bold text-black overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-casino-gold/50 hover:scale-105">
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Start Playing Now
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </span>
                  </button>
                </Link>
                
                <div className="flex items-center gap-2 text-[#9ca3af]">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-casino-green/20 border-2 border-[#111827]" />
                    <div className="w-8 h-8 rounded-full bg-casino-gold/20 border-2 border-[#111827]" />
                    <div className="w-8 h-8 rounded-full bg-casino-green/20 border-2 border-[#111827]" />
                  </div>
                  <span className="text-sm">Join 10,000+ active players</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}