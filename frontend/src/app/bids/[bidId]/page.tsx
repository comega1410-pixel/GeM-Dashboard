"use client";

import { useEffect, useState, use } from "react";
import { api, ComplianceData, ComplianceResult } from "@/lib/api";
import Link from "next/link";

export default function BidDetailPage({
  params,
}: {
  params: Promise<{ bidId: string }>;
}) {
  const { bidId } = use(params);
  const [data, setData] = useState<ComplianceData | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [polling, setPolling] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const compliance = await api.getCompliance(bidId);
      setData(compliance);
      if (compliance.bid.status === "PROCESSING") {
        setPolling(true);
      } else {
        setPolling(false);
      }
    } catch {
      // Bid might still be processing — poll
      try {
        const bid = await api.getBid(bidId);
        if (bid.status === "PROCESSING") {
          setPolling(true);
          setData({
            bid,
            results: [],
            riskScore: {
              technicalCompliance: 0,
              financialCompliance: 0,
              experienceCompliance: 0,
              certificationCompliance: 0,
              documentationCompliance: 0,
              overallCompliance: 0,
              riskLevel: "LOW",
              mandatoryFailures: 0,
              totalRequirements: 0,
              compliant: 0,
              nonCompliant: 0,
              needsReview: 0,
              recommendation: "",
            },
          } as ComplianceData);
        }
      } catch {
        // noop
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [bidId]);

  // Poll while processing
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [polling, bidId]);

  const loadSummary = async () => {
    if (summary || summaryLoading) return;
    setSummaryLoading(true);
    try {
      const res = await api.getSummary(bidId);
      setSummary(res.summary);
    } catch {
      setSummary("Unable to generate summary.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    if (downloadingReport) return;
    setDownloadingReport(true);
    setError(null);
    try {
      await api.downloadReport(bidId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleReanalyze = async () => {
    if (reanalyzing) return;
    setReanalyzing(true);
    setError(null);
    try {
      await api.triggerAnalysis(bidId);
      setPolling(true);
      setData((prev) => prev ? { ...prev, bid: { ...prev.bid, status: 'PROCESSING' } } : prev);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReanalyzing(false);
    }
  };

  const filteredResults = data?.results.filter((r) => {
    if (filter === "ALL") return true;
    return r.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-72px)]">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-border-default border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-[1400px] mx-auto px-8 py-10">
        <div className="card-base text-center py-16">
          <p className="text-5xl mb-4">⚠️</p>
          <p className="text-text-secondary text-lg">Bid not found</p>
          <Link
            href="/"
            className="inline-block mt-4 text-accent hover:text-teal"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { bid, riskScore } = data;
  const isProcessing = bid.status === "PROCESSING";

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-10 min-h-[calc(100vh-72px)]">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 animate-fade-in">
        <div>
          <Link
            href="/bids"
            className="text-xs text-text-muted hover:text-accent mb-2 inline-block"
          >
            ← All Analyses
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight mb-1">
            {bid.title}
          </h1>
          <p className="text-text-secondary text-sm">
            {bid.gemBidNumber || "No bid number"} · Created{" "}
            {new Date(bid.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isProcessing && (
            <div className="flex items-center gap-2 px-4 py-2 bg-warning-bg border border-warning-border rounded-xl text-warning text-sm font-medium">
              <span className="w-3 h-3 border-2 border-warning/30 border-t-warning rounded-full animate-spin" />
              Analyzing...
            </div>
          )}
          {bid.status === 'ANALYZED' && (
            <>
              <button
                onClick={handleDownloadReport}
                disabled={downloadingReport}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-accent to-accent-light text-white font-semibold text-sm cursor-pointer shadow-[0_4px_15px_var(--color-accent-glow)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {downloadingReport ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>📄 Download Report</>
                )}
              </button>
              <StatusBadge status={bid.status} />
            </>
          )}
          {bid.status === 'ERROR' && (
            <>
              <button
                onClick={handleReanalyze}
                disabled={reanalyzing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-warning to-amber-400 text-white font-semibold text-sm cursor-pointer hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {reanalyzing ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Re-analyzing...
                  </>
                ) : (
                  <>🔄 Re-analyze</>
                )}
              </button>
              <StatusBadge status={bid.status} />
            </>
          )}
          {bid.status === 'UPLOADED' && (
            <StatusBadge status={bid.status} />
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-danger-bg border border-danger-border rounded-xl text-danger text-sm font-medium animate-fade-in">
          {error}
        </div>
      )}

      {bid.status === 'ERROR' ? (
        <div className="card-base text-center py-20 animate-slide-up">
          <p className="text-6xl mb-6">⚠️</p>
          <h2 className="text-xl font-bold mb-2 text-danger">Analysis Failed</h2>
          <p className="text-text-secondary mb-4 max-w-md mx-auto">
            Something went wrong during the compliance analysis. This could be due to
            unreadable documents, API issues, or processing errors.
          </p>
          <button
            onClick={handleReanalyze}
            disabled={reanalyzing}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-warning to-amber-400 text-white font-semibold text-sm cursor-pointer shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            {reanalyzing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Re-analyzing...
              </>
            ) : (
              <>🔄 Try Again</>
            )}
          </button>
        </div>
      ) : isProcessing ? (
        <div className="card-base text-center py-20 animate-slide-up">
          <div className="w-16 h-16 border-4 border-border-default border-t-accent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-bold mb-2">Analysis in Progress</h2>
          <p className="text-text-secondary mb-2 max-w-md mx-auto">
            Processing documents, extracting requirements, and evaluating
            compliance. This typically takes 1-3 minutes.
          </p>
          <p className="text-xs text-text-muted">
            This page will auto-refresh when analysis completes.
          </p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-slide-up">
            <StatCard
              value={riskScore.totalRequirements}
              label="Requirements"
              color="text-accent"
            />
            <StatCard
              value={riskScore.compliant}
              label="Compliant"
              color="text-success"
              icon="🟢"
            />
            <StatCard
              value={riskScore.needsReview}
              label="Needs Review"
              color="text-warning"
              icon="🟡"
            />
            <StatCard
              value={riskScore.nonCompliant}
              label="Non-Compliant"
              color="text-danger"
              icon="🔴"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            {/* Risk Scorecard — Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              {/* Risk Level */}
              <div className="card-base text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                  Risk Level
                </p>
                <div
                  className={`inline-block px-5 py-2 rounded-xl font-bold text-sm uppercase tracking-widest ${riskLevelStyle(riskScore.riskLevel)}`}
                >
                  {riskScore.riskLevel}
                </div>
                {riskScore.mandatoryFailures > 0 && (
                  <div className="mt-3 px-3 py-2 bg-danger-bg border border-danger-border rounded-lg text-danger text-xs font-medium">
                    🔴 {riskScore.mandatoryFailures} mandatory failure
                    {riskScore.mandatoryFailures > 1 ? "s" : ""}
                  </div>
                )}
              </div>

              {/* Category Scores */}
              <div className="card-base">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">
                  Category Breakdown
                </p>
                <div className="space-y-3">
                  <CategoryBar
                    label="Financial"
                    value={riskScore.financialCompliance}
                  />
                  <CategoryBar
                    label="Technical"
                    value={riskScore.technicalCompliance}
                  />
                  <CategoryBar
                    label="Experience"
                    value={riskScore.experienceCompliance}
                  />
                  <CategoryBar
                    label="Certification"
                    value={riskScore.certificationCompliance}
                  />
                  <CategoryBar
                    label="Documentation"
                    value={riskScore.documentationCompliance}
                  />
                </div>
              </div>

              {/* Recommendation */}
              <div className="card-base">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Recommendation
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {riskScore.recommendation}
                </p>
              </div>

              {/* Executive Summary */}
              <div className="card-base">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    AI Summary
                  </p>
                  {!summary && !summaryLoading && (
                    <button
                      onClick={loadSummary}
                      className="text-xs text-accent hover:text-teal cursor-pointer transition-colors"
                    >
                      Generate
                    </button>
                  )}
                </div>
                {summaryLoading ? (
                  <div className="flex items-center gap-2 text-text-muted text-sm">
                    <span className="w-3 h-3 border-2 border-border-default border-t-accent rounded-full animate-spin" />
                    Generating...
                  </div>
                ) : summary ? (
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {summary}
                  </p>
                ) : (
                  <p className="text-sm text-text-muted italic">
                    Click generate to create an AI-powered summary.
                  </p>
                )}
              </div>
            </div>

            {/* Compliance Matrix — Main area */}
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Compliance Matrix</h2>
                <div className="flex items-center gap-2">
                  {["ALL", "COMPLIANT", "NON_COMPLIANT", "NEEDS_REVIEW"].map(
                    (f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                          filter === f
                            ? "bg-accent text-white"
                            : "bg-bg-tertiary text-text-muted hover:text-text-primary border border-border-default"
                        }`}
                      >
                        {f === "ALL"
                          ? "All"
                          : f === "COMPLIANT"
                            ? "✅ Pass"
                            : f === "NON_COMPLIANT"
                              ? "❌ Fail"
                              : "⚠️ Review"}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border-default">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-bg-tertiary border-b border-border-default w-20">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-bg-tertiary border-b border-border-default">
                        Requirement
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-bg-tertiary border-b border-border-default w-28">
                        Evidence
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-bg-tertiary border-b border-border-default w-28">
                        Result
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-bg-tertiary border-b border-border-default w-28">
                        Confidence
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredResults || []).map((result) => (
                      <ComplianceRow
                        key={result.id}
                        result={result}
                        expanded={expandedRow === result.id}
                        onToggle={() =>
                          setExpandedRow(
                            expandedRow === result.id ? null : result.id
                          )
                        }
                      />
                    ))}
                    {(filteredResults || []).length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-12 text-center text-text-muted text-sm"
                        >
                          No results match the current filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────── */

function ComplianceRow({
  result,
  expanded,
  onToggle,
}: {
  result: ComplianceResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusIcon =
    result.status === "COMPLIANT"
      ? "🟢"
      : result.status === "NON_COMPLIANT"
        ? "🔴"
        : "🟡";

  const statusLabel =
    result.status === "COMPLIANT"
      ? "Pass"
      : result.status === "NON_COMPLIANT"
        ? "Fail"
        : "Review";

  const statusStyle =
    result.status === "COMPLIANT"
      ? "bg-success-bg text-success border-success-border"
      : result.status === "NON_COMPLIANT"
        ? "bg-danger-bg text-danger border-danger-border"
        : "bg-warning-bg text-warning border-warning-border";

  const confColor =
    result.confidence >= 0.8
      ? "bg-success"
      : result.confidence >= 0.5
        ? "bg-warning"
        : "bg-danger";

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-bg-glass transition-colors"
      >
        <td className="px-4 py-3.5 border-b border-border-default">
          <span className="text-xs font-mono text-accent font-semibold">
            {result.requirement.code}
          </span>
        </td>
        <td className="px-4 py-3.5 border-b border-border-default">
          <p className="text-sm text-text-primary font-medium line-clamp-2">
            {result.requirement.description}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-muted font-medium border border-border-default">
              {result.requirement.category}
            </span>
            {result.requirement.mandatory && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-danger-bg text-danger font-semibold border border-danger-border">
                MANDATORY
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3.5 border-b border-border-default">
          {result.evidence ? (
            <span className="text-xs text-text-secondary truncate block max-w-[120px]">
              {result.evidence.document?.originalName || "Document"}
            </span>
          ) : (
            <span className="text-xs text-text-muted italic">None</span>
          )}
        </td>
        <td className="px-4 py-3.5 border-b border-border-default">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${statusStyle}`}
          >
            {statusIcon} {statusLabel}
          </span>
        </td>
        <td className="px-4 py-3.5 border-b border-border-default">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${confColor}`}
                style={{ width: `${result.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-text-secondary min-w-[36px] text-right">
              {Math.round(result.confidence * 100)}%
            </span>
          </div>
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0">
            <div className="bg-bg-secondary border-b border-border-default px-6 py-5 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Requirement detail */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                    Requirement
                  </h4>
                  <p className="text-sm text-text-primary leading-relaxed mb-3">
                    {result.requirement.description}
                  </p>
                  {result.requirement.operator && (
                    <p className="text-xs text-text-secondary">
                      Threshold: {result.requirement.operator}{" "}
                      {result.requirement.thresholdValue}{" "}
                      {result.requirement.unit || ""}
                    </p>
                  )}
                  {result.requirement.sourcePage && (
                    <p className="text-xs text-text-muted mt-1">
                      Source: Page {result.requirement.sourcePage}
                    </p>
                  )}
                </div>

                {/* Evidence detail */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                    Evidence
                  </h4>
                  {result.evidence ? (
                    <div className="bg-bg-tertiary rounded-xl p-4 border border-border-default">
                      <p className="text-sm font-medium text-text-primary mb-1">
                        {result.evidence.document?.originalName || "Document"}
                      </p>
                      <p className="text-xs text-accent mb-2">
                        Field: {result.evidence.fieldName}
                      </p>
                      <p className="text-sm text-text-secondary mb-2">
                        Extracted: {result.evidence.extractedValue}
                      </p>
                      {result.evidence.pageNumber && (
                        <p className="text-xs text-text-muted">
                          Page {result.evidence.pageNumber}
                        </p>
                      )}
                      {result.evidence.rawText && (
                        <div className="mt-2 p-2 bg-bg-primary rounded-lg">
                          <p className="text-[11px] text-text-muted font-mono leading-relaxed">
                            &ldquo;{result.evidence.rawText}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted italic">
                      No matching evidence found.
                    </p>
                  )}
                </div>
              </div>

              {/* Decision */}
              <div className="mt-5 pt-4 border-t border-border-default">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Decision Reasoning
                </h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {result.reason}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function StatCard({
  value,
  label,
  color,
  icon,
}: {
  value: number;
  label: string;
  color: string;
  icon?: string;
}) {
  return (
    <div className="card-base text-center hover:-translate-y-1 transition-all">
      <p className={`text-4xl font-extrabold mb-1 ${color}`}>
        {icon && <span className="text-lg mr-1">{icon}</span>}
        {value}
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
    </div>
  );
}

function CategoryBar({ label, value }: { label: string; value: number }) {
  const barColor =
    value >= 80
      ? "bg-success"
      : value >= 50
        ? "bg-warning"
        : "bg-danger";

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-secondary font-medium">{label}</span>
        <span className="text-text-muted font-semibold">{value}%</span>
      </div>
      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${value}%` }}
        />
      </div>
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
      className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wide border ${styles[status] || ""}`}
    >
      {status === "ANALYZED" ? "✅ " : ""}
      {status}
    </span>
  );
}

function riskLevelStyle(level: string): string {
  switch (level) {
    case "LOW":
      return "bg-success-bg text-success border border-success-border";
    case "MEDIUM":
      return "bg-warning-bg text-warning border border-warning-border";
    case "HIGH":
      return "bg-danger-bg text-danger border border-danger-border";
    case "CRITICAL":
      return "bg-danger-bg text-danger border-2 border-danger animate-pulse-glow";
    default:
      return "bg-bg-tertiary text-text-muted";
  }
}
