"use client";

import { useEffect, useState } from "react";
import { api, Bid } from "@/lib/api";
import Link from "next/link";

export default function BidsPage() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listBids()
      .then(setBids)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-10 min-h-[calc(100vh-72px)]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-1">
            All <span className="text-gradient">Analyses</span>
          </h1>
          <p className="text-text-secondary text-sm">
            Browse and review all compliance analysis results.
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent to-accent-light text-white font-semibold text-sm shadow-[0_4px_15px_var(--color-accent-glow)] hover:-translate-y-0.5 transition-all no-underline"
        >
          + New Analysis
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-3 border-border-default border-t-accent rounded-full animate-spin" />
        </div>
      ) : bids.length === 0 ? (
        <div className="card-base text-center py-16">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-text-secondary text-lg">No analyses found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-bg-tertiary border-b border-border-default">
                  Status
                </th>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-bg-tertiary border-b border-border-default">
                  Title
                </th>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-bg-tertiary border-b border-border-default">
                  Bid Number
                </th>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-bg-tertiary border-b border-border-default">
                  Documents
                </th>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-bg-tertiary border-b border-border-default">
                  Requirements
                </th>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-bg-tertiary border-b border-border-default">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <tr
                  key={bid.id}
                  className="hover:bg-bg-glass transition-colors cursor-pointer"
                  onClick={() => (window.location.href = `/bids/${bid.id}`)}
                >
                  <td className="px-5 py-4 border-b border-border-default">
                    <StatusBadge status={bid.status} />
                  </td>
                  <td className="px-5 py-4 border-b border-border-default">
                    <span className="font-medium text-text-primary text-sm">
                      {bid.title}
                    </span>
                  </td>
                  <td className="px-5 py-4 border-b border-border-default text-sm text-text-secondary">
                    {bid.gemBidNumber || "—"}
                  </td>
                  <td className="px-5 py-4 border-b border-border-default text-sm text-text-secondary">
                    {bid._count?.documents || 0}
                  </td>
                  <td className="px-5 py-4 border-b border-border-default text-sm text-text-secondary">
                    {bid._count?.requirements || 0}
                  </td>
                  <td className="px-5 py-4 border-b border-border-default text-sm text-text-muted">
                    {new Date(bid.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    UPLOADED: "bg-bg-tertiary text-text-muted border-border-default",
    PROCESSING: "bg-warning-bg text-warning border-warning-border",
    ANALYZED: "bg-success-bg text-success border-success-border",
    ERROR: "bg-danger-bg text-danger border-danger-border",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${styles[status] || ""}`}
    >
      {status}
    </span>
  );
}
