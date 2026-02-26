'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSectionNavScroll } from '@/hooks/useSectionNavScroll';
// Slightly below navbar so the bar isn’t clipped at the top (py-4 + content + safe area)
// Full-height nav ≈ 64px. When scrolled, nav uses py-2 ≈ 48px.
const TOP_OFFSET_COMPACT = 'calc(48px + env(safe-area-inset-top, 0px))';

const SECTIONS = [
  { href: '/tournaments', label: 'Tournaments', match: (path: string) => path.startsWith('/tournaments') },
  { href: '/standings/weekly', label: 'Weekly', match: (path: string) => path.startsWith('/standings/weekly') },
  { href: '/standings/season', label: 'Season', match: (path: string) => path.startsWith('/standings/season') },
] as const;

export function MobileSectionNav() {
  const pathname = usePathname();
  const showBar = useSectionNavScroll();

  if (!showBar) return null;

  return (
    <div
      className="fixed left-0 right-0 z-40 pb-0 px-4 bg-casino-bg/95 backdrop-blur-md md:hidden"
      style={{ top: TOP_OFFSET_COMPACT }}
    >
      <div className="max-w-7xl mx-auto flex overflow-hidden border border-casino-gold/20 bg-casino-card/30 min-w-0 w-full">
        {SECTIONS.map((section) => {
          const isActive = section.match(pathname ?? '');
          return (
            <Link
              key={section.href}
              href={section.href}
              className={`flex-1 pt-2 pb-1 text-center text-sm font-medium transition-colors border-r border-casino-gold/20 last:border-r-0 leading-normal ${
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
