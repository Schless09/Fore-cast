'use client';

import { SignIn } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AuthContent() {
  const searchParams = useSearchParams();
  const invite = searchParams.get('invite');
  const leagueName = searchParams.get('league');
  const redirectUrl = invite ? `/invite/${invite}` : '/the-club-house';

  return (
    <>
      {invite && leagueName && (
        <div className="mb-6 p-4 bg-casino-elevated border border-casino-gold/30 rounded-lg text-center">
          <p className="text-casino-gray text-sm">You&apos;ve been invited to join</p>
          <p className="text-casino-gold font-semibold text-lg">{decodeURIComponent(leagueName)}</p>
          <p className="text-casino-gray text-sm mt-1">Sign in or create an account to join the league</p>
        </div>
      )}
      <SignIn 
        routing="hash"
        afterSignInUrl={redirectUrl}
        afterSignUpUrl={redirectUrl}
        appearance={{
        elements: {
          rootBox: 'w-full',
          card: 'bg-casino-card border border-casino-gold/30 shadow-xl',
          headerTitle: 'text-casino-gold font-orbitron',
          headerSubtitle: 'text-casino-gray',
          socialButtonsBlockButton: 'bg-casino-elevated border border-casino-gold/50 text-casino-text hover:bg-casino-card hover:border-casino-gold/70',
          formFieldLabel: 'text-casino-text',
          formFieldInput: 'bg-casino-elevated border border-casino-gold/50 text-casino-text focus:border-casino-gold focus:ring-1 focus:ring-casino-gold/50',
          footerActionLink: 'text-casino-green hover:text-casino-gold',
          formButtonPrimary: 'bg-casino-gold hover:bg-casino-gold/90 text-black',
          dividerLine: 'bg-casino-gold/30',
          dividerText: 'text-casino-gray',
        },
        variables: {
          colorPrimary: '#fbbf24',
          colorBackground: '#1a1a2e',
          colorText: '#e5e5e5',
          colorTextSecondary: '#9ca3af',
          borderRadius: '0.5rem',
        },
      }}
      />
    </>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-casino-bg via-casino-elevated to-casino-bg px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-casino-gold mb-2 font-orbitron tracking-wider">FORE!SIGHT</h1>
          <p className="text-lg font-semibold text-casino-green mb-1">Predict. Play. Win.</p>
          <p className="text-casino-gray">Fantasy Golf Leaderboard</p>
        </div>
        
        <Suspense fallback={<div className="text-center text-casino-text">Loading...</div>}>
          <AuthContent />
        </Suspense>
      </div>
    </div>
  );
}
