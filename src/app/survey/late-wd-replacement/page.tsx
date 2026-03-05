'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@clerk/nextjs';

type Vote = 'yes' | 'no' | 'same_or_below' | null;

interface SurveyData {
  question: string;
  optionsNote?: string;
  yesCount: number;
  noCount: number;
  sameOrBelowCount: number;
  myVote: Vote;
}

export default function LateWdReplacementSurveyPage() {
  const { isSignedIn } = useAuth();
  const [data, setData] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<Vote>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/survey/late-wd-replacement');
        const json = await res.json();
        if (!cancelled && json.success) {
          setData({
            question: json.question,
            optionsNote: json.optionsNote,
            yesCount: json.yesCount ?? 0,
            noCount: json.noCount ?? 0,
            sameOrBelowCount: json.sameOrBelowCount ?? 0,
            myVote: json.myVote ?? null,
          });
        } else if (!cancelled && !json.success) {
          setError(json.error ?? 'Failed to load survey');
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load survey');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refetch = async () => {
    const res = await fetch('/api/survey/late-wd-replacement');
    const json = await res.json();
    if (json.success) {
      setData({
        question: json.question,
        optionsNote: json.optionsNote,
        yesCount: json.yesCount ?? 0,
        noCount: json.noCount ?? 0,
        sameOrBelowCount: json.sameOrBelowCount ?? 0,
        myVote: json.myVote ?? null,
      });
    }
  };

  const submitVote = async (vote: Vote) => {
    if (!isSignedIn) return;
    setSubmitting(vote);
    setError(null);
    try {
      const res = await fetch('/api/survey/late-wd-replacement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      });
      const json = await res.json();
      if (json.success) {
        await refetch();
      } else {
        setError(json.error ?? 'Failed to save vote');
      }
    } catch {
      setError('Failed to save vote');
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-[#0a0f1a] via-[#111827] to-[#0a0f1a] flex items-center justify-center">
        <p className="text-casino-gray">Loading survey…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-linear-to-b from-[#0a0f1a] via-[#111827] to-[#0a0f1a] px-4 py-12">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/" className="text-casino-gold hover:underline">← Back to home</Link>
        </div>
      </div>
    );
  }

  const total = (data?.yesCount ?? 0) + (data?.noCount ?? 0) + (data?.sameOrBelowCount ?? 0);
  const yesPct = total > 0 ? Math.round(((data?.yesCount ?? 0) / total) * 100) : 0;
  const noPct = total > 0 ? Math.round(((data?.noCount ?? 0) / total) * 100) : 0;
  const sameOrBelowPct = total > 0 ? Math.round(((data?.sameOrBelowCount ?? 0) / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-linear-to-b from-[#0a0f1a] via-[#111827] to-[#0a0f1a]">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center text-casino-gold hover:text-casino-gold/80 text-sm mb-8 transition-colors"
        >
          ← Back to home
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold font-orbitron mb-2 bg-linear-to-r from-casino-gold to-casino-gold-light bg-clip-text text-transparent">
          Late withdrawal & roster replacement
        </h1>
        <p className="text-casino-gray text-sm mb-4">
          Your vote helps us decide how to handle last‑minute WDs.
        </p>
        <p className="text-amber-200/90 text-sm mb-8 font-medium">
          Your choice will shape how we handle late WDs for <strong>this tournament and future ones</strong>.
        </p>

        <Card className="bg-casino-card/90 border border-casino-gold/20">
          <CardHeader>
            <CardTitle className="text-lg text-casino-text">Survey</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-casino-text leading-relaxed">
              {data?.question ?? 'When a golfer withdraws late and a replacement gets their spot, how should we handle rosters that had the withdrawn player? This applies to this tournament and future ones.'}
            </p>
            {data?.optionsNote && (
              <p className="text-casino-gray text-sm">
                {data.optionsNote}
              </p>
            )}

            {!isSignedIn ? (
              <p className="text-amber-400/90 text-sm">
                Sign in to vote. Your opinion matters.
              </p>
            ) : data?.myVote != null ? (
              <div className="space-y-4">
                <p className="text-casino-gold font-medium">
                  You voted: {data.myVote === 'yes'
                    ? 'Yes, replace with alternate (Haotong Li)'
                    : data.myVote === 'same_or_below'
                      ? 'Yes, replace with Viktor Hovland'
                      : 'No — leave as-is'}
                </p>
                <p className="text-casino-gray text-sm">
                  Thanks for voting. You can change your vote below.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => submitVote('yes')}
                    disabled={submitting !== null}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition text-left ${
                      data.myVote === 'yes'
                        ? 'bg-casino-gold/20 border border-casino-gold/50 text-casino-gold'
                        : 'bg-white/5 border border-white/20 text-casino-gray hover:border-casino-gold/30'
                    } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Yes, replace with alternate (Haotong Li)
                  </button>
                  <button
                    onClick={() => submitVote('same_or_below')}
                    disabled={submitting !== null}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition text-left ${
                      data.myVote === 'same_or_below'
                        ? 'bg-casino-gold/20 border border-casino-gold/50 text-casino-gold'
                        : 'bg-white/5 border border-white/20 text-casino-gray hover:border-casino-gold/30'
                    } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Yes, replace with Viktor Hovland
                  </button>
                  <button
                    onClick={() => submitVote('no')}
                    disabled={submitting !== null}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition text-left ${
                      data.myVote === 'no'
                        ? 'bg-casino-gold/20 border border-casino-gold/50 text-casino-gold'
                        : 'bg-white/5 border border-white/20 text-casino-gray hover:border-casino-gold/30'
                    } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    No — leave as-is
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => submitVote('yes')}
                  disabled={submitting !== null}
                  className="w-full px-6 py-3 rounded-xl bg-casino-gold/20 border border-casino-gold/40 text-casino-gold font-semibold hover:bg-casino-gold/30 hover:border-casino-gold/60 transition disabled:opacity-50 text-left"
                >
                  {submitting === 'yes' ? 'Saving…' : 'Yes, replace with alternate (Haotong Li)'}
                </button>
                <button
                  onClick={() => submitVote('same_or_below')}
                  disabled={submitting !== null}
                  className="w-full px-6 py-3 rounded-xl bg-white/5 border border-casino-gold/30 text-casino-text font-medium hover:border-casino-gold/40 hover:bg-casino-gold/10 transition disabled:opacity-50 text-left"
                >
                  {submitting === 'same_or_below' ? 'Saving…' : 'Yes, replace with Viktor Hovland'}
                </button>
                <button
                  onClick={() => submitVote('no')}
                  disabled={submitting !== null}
                  className="w-full px-6 py-3 rounded-xl bg-white/5 border border-white/20 text-casino-text font-medium hover:border-white/40 hover:bg-white/10 transition disabled:opacity-50 text-left"
                >
                  {submitting === 'no' ? 'Saving…' : 'No — leave as-is'}
                </button>
                <p className="text-casino-gray text-xs">
                  Same price or below = replace only with a golfer at the same cost or the next lower cost (e.g. Jake Knapp was $5.35, Viktor Hovland was also $5.35).
                </p>
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            {data?.myVote != null && (
              <div className="pt-4 border-t border-white/10">
                <p className="text-casino-gray text-sm mb-2">Results so far ({total} vote{total !== 1 ? 's' : ''})</p>
                <div className="flex flex-wrap gap-4">
                  <span className="text-casino-gold">Haotong Li: {data?.yesCount ?? 0} ({yesPct}%)</span>
                  <span className="text-amber-300/90">Viktor Hovland: {data?.sameOrBelowCount ?? 0} ({sameOrBelowPct}%)</span>
                  <span className="text-casino-gray">No — leave as-is: {data?.noCount ?? 0} ({noPct}%)</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
