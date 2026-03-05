import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';

const SURVEY_SLUG = 'late-wd-auto-replace';

async function getProfileId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single();
  return data?.id ?? null;
}

/** GET: Return survey question, current user's vote (if any), and aggregate counts. */
export async function GET() {
  try {
    const supabase = createServiceClient();

    const [countsRes, profileId] = await Promise.all([
      supabase
        .from('survey_votes')
        .select('vote')
        .eq('survey_slug', SURVEY_SLUG),
      getProfileId(),
    ]);

    if (countsRes.error) {
      console.error('Survey counts error:', countsRes.error);
      return NextResponse.json(
        { success: false, error: 'Failed to load survey' },
        { status: 500 }
      );
    }

    const votes = countsRes.data ?? [];
    const yesCount = votes.filter((v) => v.vote === 'yes').length;
    const noCount = votes.filter((v) => v.vote === 'no').length;

    let myVote: 'yes' | 'no' | null = null;
    if (profileId) {
      const { data: myRow } = await supabase
        .from('survey_votes')
        .select('vote')
        .eq('survey_slug', SURVEY_SLUG)
        .eq('profile_id', profileId)
        .single();
      if (myRow) myVote = myRow.vote as 'yes' | 'no';
    }

    return NextResponse.json({
      success: true,
      question: 'Going forward, whenever a golfer withdraws late and a replacement gets their spot (e.g. Jake Knapp WD, Haotong Li replaces him), should we automatically update rosters that had the withdrawn player to use the replacement — for every tournament, not just this one?',
      yesCount,
      noCount,
      myVote,
    });
  } catch (err) {
    console.error('Survey GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load survey' },
      { status: 500 }
    );
  }
}

/** POST: Submit or update vote. Body: { vote: 'yes' | 'no' }. */
export async function POST(request: NextRequest) {
  try {
    const profileId = await getProfileId();
    if (!profileId) {
      return NextResponse.json(
        { success: false, error: 'Sign in to vote' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const vote = body?.vote === 'yes' ? 'yes' : body?.vote === 'no' ? 'no' : null;
    if (!vote) {
      return NextResponse.json(
        { success: false, error: 'Vote must be "yes" or "no"' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    // One vote per user: upsert so existing row is updated if they change their vote
    const { error } = await supabase
      .from('survey_votes')
      .upsert(
        { profile_id: profileId, survey_slug: SURVEY_SLUG, vote },
        { onConflict: 'profile_id,survey_slug' }
      );

    if (error) {
      console.error('Survey vote upsert error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save vote' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, vote });
  } catch (err) {
    console.error('Survey POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to save vote' },
      { status: 500 }
    );
  }
}
