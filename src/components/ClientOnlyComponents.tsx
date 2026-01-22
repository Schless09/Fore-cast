'use client';

import dynamic from 'next/dynamic';

// Dynamically import client-only components to avoid hydration mismatches
const ErrorHandler = dynamic(() => import('@/components/ErrorHandler').then(mod => ({ default: mod.ErrorHandler })), {
  ssr: false,
});

const EnvWarningBanner = dynamic(() => import('@/components/EnvWarningBanner').then(mod => ({ default: mod.EnvWarningBanner })), {
  ssr: false,
});

export function ClientOnlyComponents() {
  return (
    <>
      <ErrorHandler />
      <EnvWarningBanner />
    </>
  );
}
