'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const SCROLL_THRESHOLD = 60;

const SECTION_PATHS = ['/tournaments', '/standings/weekly', '/standings/season'] as const;

function isOnSectionPage(path: string | null): boolean {
  if (!path) return false;
  return SECTION_PATHS.some((base) => path.startsWith(base));
}

/**
 * Returns true when the mobile section nav bar should be visible (user scrolled on a section page).
 * Used by MobileSectionNav to show the bar and by Navbar to inset the main nav on mobile.
 */
export function useSectionNavScroll(): boolean {
  const pathname = usePathname();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [showBar, setShowBar] = useState(false);
  const isOnSection = isOnSectionPage(pathname);

  useEffect(() => {
    if (!isOnSection || !isMobile) {
      setShowBar(false);
      return;
    }

    const onScroll = () => {
      setShowBar(window.scrollY > SCROLL_THRESHOLD);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isOnSection, isMobile]);

  return isMobile && isOnSection && showBar;
}
