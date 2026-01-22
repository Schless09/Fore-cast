'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load user profile when user is available
  useEffect(() => {
    if (user) {
      const supabase = createClient();
      supabase
        .from('profiles')
        .select('username, email')
        .eq('id', user.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setProfile(data);
          } else {
            // Fallback to user email if profile not found
            setProfile({ username: user.email?.split('@')[0] || 'User', email: user.email });
          }
        });
    } else {
      setProfile(null);
    }
  }, [user]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (isLoading) {
    return (
      <nav className="bg-casino-bg/95 backdrop-blur-md border-b border-casino-gold/20 px-4 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold bg-linear-to-r from-casino-gold to-[#f59e0b] bg-clip-text text-transparent font-orbitron tracking-wider">
            FORE!CAST
          </Link>
        </div>
      </nav>
    );
  }

  if (!user) {
    return (
      <nav className="bg-casino-bg/95 backdrop-blur-md border-b border-casino-gold/20 px-4 py-4 sticky top-0 z-50 shadow-[0_4px_20px_rgba(251,191,36,0.1)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold bg-linear-to-r from-casino-gold to-[#f59e0b] bg-clip-text text-transparent font-orbitron tracking-wider hover:scale-105 transition-transform">
            FORE!CAST
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-casino-text hover:text-casino-gold font-medium transition-colors"
            >
              Sign In
            </Link>
            <Link href="/auth/signup">
              <button className="btn-casino-gold px-6 py-2 rounded-lg font-semibold">
                Sign Up
              </button>
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  return (
      <nav className="bg-casino-bg/95 backdrop-blur-md border-b border-casino-gold/20 px-4 py-4 sticky top-0 z-50 shadow-[0_4px_20px_rgba(251,191,36,0.1)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-2xl font-bold bg-linear-to-r from-casino-gold to-[#f59e0b] bg-clip-text text-transparent font-orbitron tracking-wider hover:scale-105 transition-transform">
            FORE!CAST
          </Link>
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="text-casino-text hover:text-casino-gold font-medium transition-all hover:tracking-wide"
          >
            Dashboard
          </Link>
          <Link
            href="/tournaments"
            className="text-casino-text hover:text-casino-gold font-medium transition-all hover:tracking-wide"
          >
            Tournaments
          </Link>
          <Link
            href="/standings/weekly"
            className="text-casino-text hover:text-casino-gold font-medium transition-all hover:tracking-wide"
          >
            Weekly
          </Link>
          <Link
            href="/standings/season"
            className="text-casino-text hover:text-casino-gold font-medium transition-all hover:tracking-wide"
          >
            Season
          </Link>
          <div className="flex items-center gap-3 pl-6 border-l border-casino-gold/30">
            {profile && (
              <span className="text-sm text-casino-gold font-semibold tracking-wide">
                {profile.username || profile.email?.split('@')[0] || 'User'}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="text-casino-gray hover:text-casino-text text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
