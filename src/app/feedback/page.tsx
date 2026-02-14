import type { Metadata } from 'next';
import Link from 'next/link';
import { FeedbackForm } from '@/app/feedback/FeedbackForm';

export const metadata: Metadata = {
  title: 'Feedback',
  description: 'Submit a feature request or bug report for FORE!SIGHT.',
};

export default function FeedbackPage() {
  return (
    <div className="min-h-screen bg-casino-dark text-casino-text">
      <div className="max-w-xl mx-auto px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-casino-gold hover:underline text-sm mb-6"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-casino-gold mb-2">
          Help us build a better FORE!SIGHT
        </h1>
        <p className="text-casino-gray text-sm mb-8">
          Whether you&apos;ve spotted a glitch or have a &quot;what if&quot; idea, we want to hear it. Your feedback makes FORE!SIGHT better every week.
          <br /><br />
          Screenshots help. Brutal honesty also helps.
        </p>
        <FeedbackForm />
      </div>
    </div>
  );
}
