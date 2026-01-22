import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "FORE!cast Golf - Predict. Play. Win.",
  description: "Predict. Play. Win. Create rosters of PGA Tour players and track their performance in real-time",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased relative`}
        suppressHydrationWarning
      >
        <ClientOnlyComponents />
        <ErrorBoundary>
          <div className="relative z-10">
            <Navbar />
            <main className="relative">
              {children}
            </main>
          </div>
        </ErrorBoundary>
      </body>
    </html>
  );
}
