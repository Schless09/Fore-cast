import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/analytics/page-view
 * Record a page view for the authenticated user.
 * Called by PageViewTracker on /tournaments, /standings/weekly, /standings/season.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: true }); // Silently ignore unauthenticated
    }

    const body = await request.json();
    const path = typeof body?.path === 'string' ? body.path : null;
    if (!path) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Resolve profile id from clerk_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ ok: true }); // Silently ignore if no profile
    }

    await supabase.from('page_views').insert({
      user_id: profile.id,
      path,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Fail silently to avoid disrupting UX
  }
}
