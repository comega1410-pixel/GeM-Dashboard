"use client";

import { useEffect, useState } from "react";
import { api, Bid } from "@/lib/api";
import Link from "next/link";

export default function DashboardPage() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listBids()
      .then(setBids)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const analyzed = bids.filter((b) => b.status === "ANALYZED");
  const processing = bids.filter((b) => b.status === "PROCESSING");

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-10 min-h-[calc(100vh-72px)]">
      {/* Hero */}
      <div className="mb-12 animate-fade-in">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3">
          <span className="text-gradient">Compliance</span> Dashboard
        </h1>
        <p className="text-text-secondary text-lg max-w-2xl">
          AI-powered bid compliance verification for Government e-Marketplace.
          Upload tender documents and get instant, evidence-grounded analysis.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          {
            value: bids.length,
            label: "Total Bids",
            color: "text-accent",
          },
          {
            value: analyzed.length,
            label: "Analyzed",
            color: "text-success",
          },
          {
            value: processing.length,
            label: "Processing",
            color: "text-warning",
          },
          {
            value: bids.reduce((n, b) => n + (b._count?.documents || 0), 0),
            label: "Documents",
            color: "text-teal",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="card-base text-center hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <p className={`text-5xl font-extrabold mb-2 ${stat.color}`}>
              {loading ? "—" : stat.value}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <Link
          href="/upload"
          className="card-base group flex items-center gap-5 hover:-translate-y-1 hover:shadow-lg no-underline"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
            📤
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary mb-1">
              New Compliance Analysis
            </h3>
            <p className="text-sm text-text-secondary">
              Upload a GeM bid document and bidder submissions for automated
              verification.
            </p>
          </div>
        </Link>

        <Link
          href="/bids"
          className="card-base group flex items-center gap-5 hover:-translate-y-1 hover:shadow-lg no-underline"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal to-emerald-400 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
            📊
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary mb-1">
              View All Analyses
            </h3>
            <p className="text-sm text-text-secondary">
              Browse previous compliance reports and review audit trails.
            </p>
          </div>
        </Link>
      </div>

      {/* Recent bids */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Recent Analyses</h2>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-3 border-border-default border-t-accent rounded-full animate-spin" />
          </div>
        ) : bids.length === 0 ? (
          <div className="card-base text-center py-16">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-text-secondary text-lg mb-2">
              No analyses yet
            </p>
            <p className="text-text-muted text-sm mb-6">
              Upload your first GeM bid to get started.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-accent to-accent-light text-white font-semibold shadow-lg hover:-translate-y-0.5 transition-all no-underline"
            >
              Start Analysis →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bids.slice(0, 5).map((bid) => (
              <Link
                key={bid.id}
                href={`/bids/${bid.id}`}
                className="card-base flex items-center justify-between no-underline hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-4">
                  <StatusDot status={bid.status} />
                  <div>
                    <p className="font-semibold text-text-primary">
                      {bid.title}
                    </p>
                    <p className="text-xs text-text-muted">
                      {bid.gemBidNumber || "No bid number"} ·{" "}
                      {new Date(bid.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-text-muted">
                    {bid._count?.documents || 0} docs
                  </span>
                  <span className="text-xs text-text-muted">
                    {bid._count?.requirements || 0} reqs
                  </span>
                  <StatusBadge status={bid.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    UPLOADED: "bg-text-muted",
    PROCESSING: "bg-accent animate-pulse-glow",
    ANALYZED: "bg-success glow-success",
    ERROR: "bg-danger glow-danger",
  };
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full inline-block ${colors[status] || "bg-text-muted"}`}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    UPLOADED:
      "bg-bg-tertiary text-text-muted border border-border-default",
    PROCESSING:
      "bg-warning-bg text-warning border border-warning-border",
    ANALYZED:
      "bg-success-bg text-success border border-success-border",
    ERROR: "bg-danger-bg text-danger border border-danger-border",
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide ${styles[status] || ""}`}
    >
      {status}
    </span>
  );
}
