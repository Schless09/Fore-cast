'use client';

import { useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardContent } from '@/components/ui/Card';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const message = searchParams.get('message');

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-green-50 to-green-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">FORE!cast Golf</h1>
          <p className="text-lg font-semibold text-green-600 mb-1">Predict. Play. Win.</p>
          <p className="text-gray-600">Fantasy Golf Leaderboard</p>
        </div>
        
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
        
        <LoginForm />
      </div>
    </div>
  );
}
