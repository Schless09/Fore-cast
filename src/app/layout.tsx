import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClientOnlyComponents } from "@/components/ClientOnlyComponents";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fore-cast-phi.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Fantasy Golf | FORE!SIGHT - Predict. Play. Win.",
    template: "%s | FORE!SIGHT Fantasy Golf",
  },
  description:
    "Fantasy golf with real stakes. Create rosters of PGA Tour players, track live scoring, and compete for prize money. The best fantasy golf app for leagues with friends.",
  keywords: [
    "Fantasy Golf",
    "fantasy golf",
    "fantasy golf app",
    "fantasy golf league",
    "PGA Tour fantasy",
    "golf picks",
    "golf league",
    "golf standings",
    "FORE!SIGHT",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "FORE!SIGHT Fantasy Golf",
    title: "Fantasy Golf | FORE!SIGHT - Predict. Play. Win.",
    description:
      "Fantasy golf with real stakes. Create PGA Tour rosters, track live scoring, compete for prize money. The best fantasy golf app for leagues.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fantasy Golf | FORE!SIGHT - Predict. Play. Win.",
    description:
      "Fantasy golf with real stakes. PGA Tour rosters, live scoring, prize money. The best fantasy golf app for leagues.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "FORE!SIGHT Fantasy Golf",
  alternateName: "FORE!SIGHT",
  description:
    "Fantasy golf app. Create PGA Tour rosters, track live scoring, compete for prize money in fantasy golf leagues.",
  url: baseUrl,
  applicationCategory: "Game",
  keywords: "Fantasy Golf, fantasy golf app, PGA Tour, golf league, golf picks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning className="dark">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased relative`}
          suppressHydrationWarning
        >
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <ClientOnlyComponents />
          <ErrorBoundary>
            <div className="relative z-10">
              <Navbar />
              <main className="relative">
                {children}
              </main>
            </div>
          </ErrorBoundary>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
