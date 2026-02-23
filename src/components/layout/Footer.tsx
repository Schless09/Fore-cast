import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-casino-gold/20 py-4 px-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-casino-gray">
        <Link href="/terms" className="hover:text-casino-gold transition-colors">
          Terms & Conditions
        </Link>
        <span aria-hidden>·</span>
        <Link href="/feedback" className="hover:text-casino-gold transition-colors">
          Feedback
        </Link>
      </div>
    </footer>
  );
}
