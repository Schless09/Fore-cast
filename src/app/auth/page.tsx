'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { UnifiedAuthForm } from '@/components/auth/UnifiedAuthForm';
import { Card, CardContent } from '@/components/ui/Card';

function AuthContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const message = searchParams.get('message');
  const invite = searchParams.get('invite');
  const league = searchParams.get('league');

  return (
    <>
      {(error || message) && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                {error}
              </div>
            )}
            {message && (
              <div className="p-3 text-sm text-green-600 bg-green-50 rounded-lg">
                {message}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      <UnifiedAuthForm inviteCode={invite || undefined} />
    </>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-casino-bg via-casino-elevated to-casino-bg px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-casino-gold mb-2 font-orbitron tracking-wider">FORE!CAST</h1>
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
