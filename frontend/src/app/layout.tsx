import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeM Compliance Copilot — AI-Powered Bid Verification",
  description:
    "Evidence-grounded, requirement-level compliance verification for Government e-Marketplace procurement with deterministic rules, semantic AI reasoning, source citations, and confidence scores.",
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
        <nav className="sticky top-0 z-50 h-[72px] bg-bg-primary/80 backdrop-blur-xl border-b border-border-default flex items-center">
          <div className="w-full max-w-[1400px] mx-auto px-8 flex items-center justify-between">
            {/* Logo */}
            <a href="/" className="flex items-center gap-3 no-underline">
              <div className="w-9 h-9 bg-gradient-to-br from-accent to-teal rounded-lg flex items-center justify-center text-white font-bold text-sm">
                G
              </div>
              <span className="text-xl font-extrabold text-text-primary">
                GeM<span className="text-accent"> Copilot</span>
              </span>
            </a>

            {/* Nav links */}
            <div className="flex items-center gap-8">
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
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="relative z-[1]">{children}</main>
      </body>
    </html>
  );
}
