'use client';

import { useEffect, useState } from 'react';
import { JoinLeagueModal } from './JoinLeagueModal';
import { checkUserLeague } from '@/lib/actions/league';

export function LeagueCheck() {
  const [showModal, setShowModal] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkLeague() {
      const result = await checkUserLeague();
      if (!result.hasLeague) {
        setShowModal(true);
      }
      setChecking(false);
    }
    checkLeague();
  }, []);

  if (checking) {
    return null; // Or a subtle loading indicator
  }

  if (!showModal) {
    return null;
  }

  return <JoinLeagueModal canClose={false} />;
}
