'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useUser, useClerk, SignUpButton } from '@clerk/nextjs';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

export function Navbar() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const unreadCount = useUnreadMessages();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (!isLoaded) {
    return (
      <nav className="bg-casino-bg/95 backdrop-blur-md border-b border-casino-gold/20 px-4 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-casino-gold font-orbitron tracking-wider -ml-2 px-2 py-1 rounded-lg hover:bg-casino-card/30 transition-colors">
            <Image src="/logo.png" alt="FORE!SIGHT" width={40} height={40} className="rounded" />
            FORE!SIGHT
          </Link>
        </div>
      </nav>
    );
  }

  if (!isSignedIn) {
    return (
      <nav className="bg-casino-bg/95 backdrop-blur-md border-b border-casino-gold/20 px-4 py-4 sticky top-0 z-50 shadow-[0_4px_20px_rgba(251,191,36,0.1)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-casino-gold font-orbitron tracking-wider -ml-2 px-2 py-1 rounded-lg hover:bg-casino-card/30 transition-colors">
            <Image src="/logo.png" alt="FORE!SIGHT" width={40} height={40} className="rounded" />
            FORE!SIGHT
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <SignUpButton mode="modal">
              <button className="btn-casino-gold px-6 py-2 rounded-lg font-semibold">
                Get Started
              </button>
            </SignUpButton>
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
              <SignUpButton mode="modal">
                <button className="btn-casino-gold px-6 py-2 rounded-lg font-semibold w-full">
                  Get Started
                </button>
              </SignUpButton>
            </div>
          </div>
        )}
      </nav>
    );
  }

  const displayName = user?.username || user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'User';
  const isAdmin = user?.username === 'aschuessontheloose';

  return (
      <nav className="bg-casino-bg/95 backdrop-blur-md border-b border-casino-gold/20 px-4 py-4 sticky top-0 z-50 shadow-[0_4px_20px_rgba(251,191,36,0.1)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-casino-gold font-orbitron tracking-wider -ml-2 px-2 py-1 rounded-lg hover:bg-casino-card/30 transition-colors">
            <Image src="/logo.png" alt="FORE!SIGHT" width={40} height={40} className="rounded" />
            FORE!SIGHT
          </Link>
        
        {/* Desktop menu */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/the-club-house"
            className="text-casino-text hover:text-casino-gold font-medium transition-all hover:tracking-wide"
          >
            The Club House
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
          <Link
            href="/feedback"
            className="text-casino-text hover:text-casino-gold font-medium transition-all hover:tracking-wide"
          >
            Feedback
          </Link>
          <Link
            href="/chat"
            className="text-casino-text hover:text-casino-gold font-medium transition-all hover:tracking-wide relative"
          >
            💬 Chat
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-3 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="text-casino-text hover:text-casino-gold font-medium transition-all hover:tracking-wide"
            >
              Admin
            </Link>
          )}
          <div className="flex items-center gap-3 pl-6 border-l border-casino-gold/30">
            <span className="text-sm text-casino-gold font-semibold tracking-wide">
              {displayName}
            </span>
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
              href="/the-club-house"
              className="text-casino-text hover:text-casino-gold hover:bg-casino-card/50 font-medium transition-all px-4 py-3 rounded-lg"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              The Club House
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
            <Link
              href="/feedback"
              className="text-casino-text hover:text-casino-gold hover:bg-casino-card/50 font-medium transition-all px-4 py-3 rounded-lg"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Feedback
            </Link>
            <Link
              href="/chat"
              className="text-casino-text hover:text-casino-gold hover:bg-casino-card/50 font-medium transition-all px-4 py-3 rounded-lg flex items-center justify-between"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>💬 League Chat</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="text-casino-text hover:text-casino-gold hover:bg-casino-card/50 font-medium transition-all px-4 py-3 rounded-lg"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Admin
              </Link>
            )}
            <div className="border-t border-casino-gold/20 mt-2 pt-2 px-4">
              <p className="text-sm text-casino-gold font-semibold mb-3">
                {displayName}
              </p>
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
