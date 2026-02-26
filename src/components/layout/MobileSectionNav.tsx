'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const SCROLL_THRESHOLD = 60;
// Slightly below navbar so the bar isn’t clipped at the top (py-4 + content + safe area)
const TOP_OFFSET = 'calc(64px + env(safe-area-inset-top, 0px))';

const SECTIONS = [
  { href: '/tournaments', label: 'Tournaments', match: (path: string) => path.startsWith('/tournaments') },
  { href: '/standings/weekly', label: 'Weekly', match: (path: string) => path.startsWith('/standings/weekly') },
  { href: '/standings/season', label: 'Season', match: (path: string) => path.startsWith('/standings/season') },
] as const;

export function MobileSectionNav() {
  const pathname = usePathname();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [showBar, setShowBar] = useState(false);

  const isOnSection = SECTIONS.some((s) => s.match(pathname ?? ''));

  useEffect(() => {
    if (!isOnSection || !isMobile) return;

    const onScroll = () => {
      setShowBar(window.scrollY > SCROLL_THRESHOLD);
    };

    onScroll(); // in case already scrolled
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isOnSection, isMobile]);

  if (!isMobile || !isOnSection) return null;
  if (!showBar) return null;

  return (
    <div
      className="fixed left-0 right-0 z-40 pt-2 pb-0 bg-casino-bg/95 backdrop-blur-md border-b border-casino-gold/20 md:hidden"
      style={{ top: TOP_OFFSET }}
    >
      <div className="max-w-7xl mx-auto flex overflow-hidden border border-casino-gold/20 bg-casino-card/30 min-w-0">
        {SECTIONS.map((section, i) => {
          const isActive = section.match(pathname ?? '');
          return (
            <Link
              key={section.href}
              href={section.href}
              className={`flex-1 py-2.5 text-center text-sm font-medium transition-colors border-r border-casino-gold/20 last:border-r-0 ${
                isActive
                  ? 'bg-casino-gold/25 text-casino-gold'
                  : 'text-casino-gray hover:text-casino-text hover:bg-casino-elevated/50'
              }`}
            >
              {section.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
