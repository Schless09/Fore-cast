'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'foresight_pool_default';

export type PoolType = 'masters' | 'majors';

interface PoolDefaultStorerProps {
  pool: PoolType;
}

/**
 * Stores the pool type (masters | majors) in localStorage when the user lands on
 * create-league?pool=masters or create-league?pool=majors. League settings will
 * read this and default tournament selection to only those events.
 */
export function PoolDefaultStorer({ pool }: PoolDefaultStorerProps) {
  useEffect(() => {
    if (typeof window !== 'undefined' && (pool === 'masters' || pool === 'majors')) {
      window.localStorage.setItem(STORAGE_KEY, pool);
    }
  }, [pool]);
  return null;
}

export { STORAGE_KEY };
