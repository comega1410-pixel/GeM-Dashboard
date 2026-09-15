import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeM Compliance Copilot — AI-Powered Bid Verification (SIH Edition)",
  description:
    "Evidence-grounded, requirement-level compliance verification for Government e-Marketplace procurement with deterministic rules, cross-document contradiction detection, human-in-the-loop review, and audit trail.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Navbar */}
        <nav className="sticky top-0 z-50 h-[72px] bg-bg-primary/90 backdrop-blur-xl border-b border-border-default flex items-center">
          <div className="w-full max-w-[1400px] mx-auto px-6 md:px-8 flex items-center justify-between">
            {/* Logo */}
            <a href="/" className="flex items-center gap-3 no-underline">
              <div className="w-9 h-9 bg-gradient-to-br from-accent to-teal rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md">
                🏛️
              </div>
              <div>
                <span className="text-lg md:text-xl font-extrabold text-text-primary">
                  GeM<span className="text-accent"> Copilot</span>
                </span>
                <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/20 text-accent border border-accent/30">
                  SIH 2026
                </span>
              </div>
            </a>

            {/* Nav links */}
            <div className="flex items-center gap-4 md:gap-8">
              <a
                href="/"
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Dashboard
              </a>
              <a
                href="/upload"
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                New Analysis
              </a>
              <a
                href="/bids"
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                All Bids
              </a>
              <a
                href="/evaluation"
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <span>⚡</span> Benchmark & Demo
              </a>
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="relative z-[1]">{children}</main>
      </body>
    </html>
  );
}
