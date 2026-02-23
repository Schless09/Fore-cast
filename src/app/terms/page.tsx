import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'Terms and conditions for FORE!SIGHT Fantasy Golf.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-casino-dark text-casino-text">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-casino-gold hover:underline text-sm mb-6"
        >
          ← Back
        </Link>

        <h1 className="text-3xl font-bold text-casino-gold mb-2">
          Terms & Conditions
        </h1>
        <p className="text-casino-gray text-sm mb-10">
          Last Updated: February 20, 2025
        </p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-casino-text">
          <p>
            Welcome to FORE!SIGHT Fantasy Golf (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;). These Terms & Conditions (&quot;Terms&quot;) govern your access and use of{' '}
            <a href="https://foresightgolfleague.com" className="text-casino-gold hover:underline">https://foresightgolfleague.com</a>
            {' '}and all associated web pages and features (collectively, the &quot;Service&quot;). By visiting or using the Service, you agree to these Terms.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using the Service you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">2. Description of Service</h2>
            <p>FORE!SIGHT provides a web-based platform to:</p>
            <ul className="list-disc pl-6 space-y-1 text-casino-gray">
              <li>Create and manage private fantasy golf leagues</li>
              <li>Build salary-cap rosters of PGA Tour players (e.g., $30 cap per tournament)</li>
              <li>Track golfer performance, live leaderboards, and weekly/season standings</li>
              <li>Allow commissioners to configure scoring, payout calculations, and league settings</li>
              <li>Provide real-time prize money calculations for golfers based on tournament position</li>
              <li>Provide league chat (league-wide and direct messages) and co-manager invitations</li>
              <li>Support Masters and Majors pool formats alongside full-season leagues</li>
              <li>Display real-time scoring and analytics using third-party data feeds</li>
            </ul>
            <p className="mt-4">Users may belong to multiple leagues. The Service does not collect, hold, or distribute league prize pools or participant buy-ins. All financial arrangements among league participants are managed outside of the Service by league commissioners.</p>
            <p>Users agree that the platform provides informational and administrative tools only and does not act as a gambling operator, intermediary, payment processor, or escrow agent.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">3. User Eligibility</h2>
            <p>You must be at least 18 years old to use the Service. By registering, you represent that you are 18 or older and capable of entering into legally binding agreements.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">4. Account Registration</h2>
            <p>To use certain features of the Service (e.g., creating or joining leagues), you must create an account with accurate information. You are responsible for securing your login credentials and are liable for all activity under your account.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">5. Fees & Payments</h2>
            <p>Commissioners may be charged an administrative fee of $2 per league member per season, with a $20 minimum, to cover hosting and third-party API costs related to scoring and data (&quot;Admin Fee&quot;). Payment of this Admin Fee is processed through third-party payment services and is non-refundable once paid.</p>
            <p>The Admin Fee does not include league prize pools, entry fees among participants, or any funds that league participants may agree to exchange among themselves.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">6. Commissioner & League Participant Responsibilities</h2>
            <p>League commissioners and participants acknowledge and agree:</p>
            <ul className="list-disc pl-6 space-y-1 text-casino-gray">
              <li>The Service is a tool for league management only.</li>
              <li>All prize pools, buy-ins, and payouts are handled outside the Service.</li>
              <li>The Service does not facilitate collection, custody, transfer, or distribution of prize funds.</li>
              <li>Commissioners are responsible for collecting any league entry fees and distributing prizes in accordance with league rules agreed among participants.</li>
            </ul>
            <p className="mt-4">You agree to comply with all applicable laws in your jurisdiction regarding participation in private leagues.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">7. User Content & Acceptable Use</h2>
            <p>You are responsible for all content you post, send, or otherwise transmit through the Service (e.g., chat messages). You agree not to use the Service to harass, abuse, threaten, impersonate, or defame others; to spam or distribute malware; or to violate any applicable law.</p>
            <p>We reserve the right to remove content and to suspend or restrict access to the Service for users who violate these Terms or engage in conduct harmful to the Service or other users.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">8. Account Termination</h2>
            <p>We may suspend or terminate your account if you materially breach these Terms or engage in conduct that harms the Service or other users. We will provide reasonable notice where practicable, except when immediate action is required for security or legal reasons.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">9. Intellectual Property</h2>
            <p>All content, graphics, trademarks, and software on the Service are our property or licensed to us, and are protected by copyright, trademark, and other laws.</p>
            <p>You may use content for personal, non-commercial use only. You may not copy, distribute, or create derivative works without our written permission.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">10. Use of Data & Third-Party Services</h2>
            <p>The Service uses third-party APIs and services (e.g., ESPN, RapidAPI) to retrieve and display real-time scoring and performance data for golfers and tournaments. Scores, event data, and similar information are provided for informational and competitive purposes only.</p>
            <p>The Service also relies on third-party providers for authentication (Clerk), data storage (Supabase), email delivery (Resend), and other infrastructure. Your use of the Service may be subject to those providers&apos; terms and privacy policies where applicable.</p>
            <p>We do not guarantee the accuracy or completeness of any third-party data, and you agree not to hold us liable for errors in scoring, delays, omissions in data feeds, or service outages caused by third-party providers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">11. Privacy</h2>
            <p>By using the Service, you agree to our practices regarding the collection, use, and storage of personal information. A separate Privacy Policy may be published; if so, it governs those practices. We process data in accordance with applicable law and our service providers&apos; obligations.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">12. Disclaimers and Limitations of Liability</h2>
            <p className="uppercase tracking-wide font-medium">THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot;</p>
            <p>We make no warranties regarding the availability, accuracy, reliability, or results of the Service.</p>
            <p className="uppercase tracking-wide font-medium mt-4">TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR LIABILITY ARISING OUT OF OR IN CONNECTION WITH THE SERVICE IS LIMITED TO THE GREATER OF (A) THE AMOUNT OF ADMIN FEES YOU (AS COMMISSIONER) HAVE PAID IN THE LAST 12 MONTHS, OR (B) $20. FOR USERS WHO HAVE NOT PAID ADMIN FEES (E.G., LEAGUE PARTICIPANTS), LIABILITY IS LIMITED TO $20.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">13. Indemnification</h2>
            <p>You agree to indemnify and hold harmless FORE!SIGHT, its affiliates, and its operators from any claims, liabilities, losses, and expenses arising out of your violation of these Terms or your use of the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">14. Governing Law</h2>
            <p>These Terms are governed by the laws of the State of Wisconsin, United States, without regard to conflict of law principles.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">15. Severability, Entire Agreement & Force Majeure</h2>
            <p>If any provision of these Terms is found unenforceable, the remaining provisions remain in effect. These Terms (and any referenced policies) constitute the entire agreement between you and us regarding the Service.</p>
            <p>We are not liable for delays or failures in performance resulting from circumstances beyond our reasonable control, including but not limited to acts of God, natural disasters, war, terrorism, pandemics, strikes, or third-party service outages (e.g., API or infrastructure failures).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">16. Changes to Terms</h2>
            <p>We may update these Terms from time to time. Your continued use of the Service signifies acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-casino-gold mt-8 mb-3">17. Contact</h2>
            <p>If you have questions about these Terms, please reach out via our feedback form:</p>
            <Link
              href="/feedback"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-casino-gold/20 text-casino-gold font-medium hover:bg-casino-gold/30 transition-colors"
            >
              Contact / Feedback →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
