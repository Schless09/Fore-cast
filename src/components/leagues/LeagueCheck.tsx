'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { JoinLeagueModal } from './JoinLeagueModal';
import { checkUserLeague } from '@/lib/actions/league';

export function LeagueCheck() {
  const [showModal, setShowModal] = useState(false);
  const [checking, setChecking] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    // Don't show modal on auth pages
    if (pathname?.startsWith('/auth/')) {
      setChecking(false);
      return;
    }

    async function checkLeague() {
      // Wait a moment after page load to ensure profile is fully created
      // This prevents the modal from showing during/immediately after signup
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const result = await checkUserLeague();
      if (!result.hasLeague) {
        setShowModal(true);
      }
      setChecking(false);
    }
    checkLeague();
  }, [pathname]);

  if (checking) {
    return null; // Or a subtle loading indicator
  }

  if (!showModal) {
    return null;
  }

  return <JoinLeagueModal canClose={false} />;
}
