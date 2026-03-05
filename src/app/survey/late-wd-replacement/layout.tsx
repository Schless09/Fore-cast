import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Survey: Late WD roster replacement | FORE!SIGHT',
  description:
    'Vote on whether we should automatically replace a withdrawn golfer with their replacement in your roster (e.g. Jake Knapp WD, Haotong Li replaces him).',
};

export default function SurveyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
