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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
          <Link href="/" className="text-2xl font-bold text-casino-gold font-orbitron tracking-wider">
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
          <Link href="/" className="text-2xl font-bold text-casino-gold font-orbitron tracking-wider hover:scale-105 transition-transform">
            FORE!CAST
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/auth">
              <button className="btn-casino-gold px-6 py-2 rounded-lg font-semibold">
                Get Started
              </button>
            </Link>
          </div>
          
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-casino-gold p-2"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
        
        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-casino-gold/20">
            <div className="flex flex-col gap-4 pt-4">
              <Link href="/auth" onClick={() => setIsMobileMenuOpen(false)}>
                <button className="btn-casino-gold px-6 py-2 rounded-lg font-semibold w-full">
                  Get Started
                </button>
              </Link>
            </div>
          </div>
        )}
      </nav>
    );
  }

  return (
      <nav className="bg-casino-bg/95 backdrop-blur-md border-b border-casino-gold/20 px-4 py-4 sticky top-0 z-50 shadow-[0_4px_20px_rgba(251,191,36,0.1)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/the-money-board" className="text-2xl font-bold text-casino-gold font-orbitron tracking-wider hover:scale-105 transition-transform">
            FORE!CAST
          </Link>
        
        {/* Desktop menu */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/the-money-board"
            className="text-casino-text hover:text-casino-gold font-medium transition-all hover:tracking-wide"
          >
            The Money Board
          </Link>
          <Link
            href="/leagues"
            className="text-casino-text hover:text-casino-gold font-medium transition-all hover:tracking-wide"
          >
            Leagues
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
        
        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden text-casino-gold p-2"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>
      
      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-casino-gold/20">
          <div className="max-w-7xl mx-auto flex flex-col gap-1 py-4">
            <Link
              href="/the-money-board"
              className="text-casino-text hover:text-casino-gold hover:bg-casino-card/50 font-medium transition-all px-4 py-3 rounded-lg"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              The Money Board
            </Link>
            <Link
              href="/leagues"
              className="text-casino-text hover:text-casino-gold hover:bg-casino-card/50 font-medium transition-all px-4 py-3 rounded-lg"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Leagues
            </Link>
            <Link
              href="/tournaments"
              className="text-casino-text hover:text-casino-gold hover:bg-casino-card/50 font-medium transition-all px-4 py-3 rounded-lg"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Tournaments
            </Link>
            <Link
              href="/standings/weekly"
              className="text-casino-text hover:text-casino-gold hover:bg-casino-card/50 font-medium transition-all px-4 py-3 rounded-lg"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Weekly Standings
            </Link>
            <Link
              href="/standings/season"
              className="text-casino-text hover:text-casino-gold hover:bg-casino-card/50 font-medium transition-all px-4 py-3 rounded-lg"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Season Standings
            </Link>
            <div className="border-t border-casino-gold/20 mt-2 pt-2 px-4">
              {profile && (
                <p className="text-sm text-casino-gold font-semibold mb-3">
                  {profile.username || profile.email?.split('@')[0] || 'User'}
                </p>
              )}
              <button
                onClick={() => {
                  handleSignOut();
                  setIsMobileMenuOpen(false);
                }}
                className="text-casino-gray hover:text-casino-text text-sm font-medium transition-colors w-full text-left py-2"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
