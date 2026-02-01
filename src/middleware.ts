import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/the-money-board(.*)',
  '/tournaments(.*)',
  '/players(.*)',
  '/admin(.*)',
  '/api/admin(.*)',
  '/leagues(.*)',
  '/standings(.*)',
  '/invite(.*)',
]);

const ADMIN_UNLOCK_COOKIE = 'admin_unlocked';

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Require admin code cookie for /admin and /api/admin (except unlock page and unlock API)
  const pathname = req.nextUrl.pathname;
  const isUnlockPage = pathname === '/admin/unlock';
  const isUnlockApi = pathname === '/api/admin/unlock';
  if (
    (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) &&
    !isUnlockPage &&
    !isUnlockApi
  ) {
    const unlocked = req.cookies.get(ADMIN_UNLOCK_COOKIE)?.value === '1';
    if (!unlocked) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const url = req.nextUrl.clone();
      url.pathname = '/admin/unlock';
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
