'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import Link from 'next/link';

/**
 * Banner that shows a warning if environment variables are not configured correctly
 */
export function EnvWarningBanner() {
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setWarningMessage('Missing Supabase environment variables. Please configure your .env or .env.local file.');
      setShowWarning(true);
    } else if (supabaseAnonKey.includes('your_') || supabaseAnonKey.includes('_here')) {
      setWarningMessage('Supabase API key appears to be a placeholder. Please update NEXT_PUBLIC_SUPABASE_ANON_KEY with your actual key.');
      setShowWarning(true);
    }
  }, []);

  if (!showWarning) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-yellow-600 text-xl">⚠️</span>
          <div>
            <p className="text-sm font-medium text-yellow-800">
              {warningMessage}
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Visit <Link href="/env-check" className="underline font-medium">/env-check</Link> for setup instructions.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowWarning(false)}
          className="text-yellow-600 hover:text-yellow-800"
          aria-label="Dismiss warning"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
