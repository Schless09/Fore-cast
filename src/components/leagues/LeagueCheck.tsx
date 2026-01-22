'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { JoinLeagueModal } from './JoinLeagueModal';
import { checkUserLeague } from '@/lib/actions/league';

export function LeagueCheck() {
  const [showModal, setShowModal] = useState(false);
  const [checking, setChecking] = useState(true);
  const pathname = usePathname();

  // Don't show modal on auth pages
  const isAuthPage = pathname?.startsWith('/auth/');

  useEffect(() => {
    // Skip the check if on auth pages
    if (isAuthPage) {
      return;
    }

    async function checkLeague() {
      // Wait a moment after page load to ensure profile is fully created
      // This prevents the modal from showing during/immediately after signup
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const result = await checkUserLeague();
      // Only show modal if user is authenticated but has no league
      if (result.isAuthenticated && !result.hasLeague) {
        setShowModal(true);
      }
      setChecking(false);
    }
    checkLeague();
  }, [pathname, isAuthPage]);

  // Don't render anything on auth pages or while checking
  if (isAuthPage || checking) {
    return null;
  }

  if (!showModal) {
    return null;
  }

  return <JoinLeagueModal canClose={false} />;
}
