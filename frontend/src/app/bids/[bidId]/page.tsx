"use client";

import { useEffect, useState, use } from "react";
import { api, ComplianceData, ComplianceResult, Contradiction, AuditLogItem } from "@/lib/api";
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
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [polling, setPolling] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Role switcher
  const [activeRole, setActiveRole] = useState<string>("PROCUREMENT_OFFICER");

  // Override Modal state
  const [overrideModalResult, setOverrideModalResult] = useState<ComplianceResult | null>(null);
  const [overrideDecision, setOverrideDecision] = useState<'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW'>('NON_COMPLIANT');
  const [overrideReason, setOverrideReason] = useState("");
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Contradiction Resolution Modal
  const [resolvingContradiction, setResolvingContradiction] = useState<Contradiction | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [submittingResolution, setSubmittingResolution] = useState(false);

  // Audit Logs Drawer
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

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
      try {
        const bid = await api.getBid(bidId);
        if (bid.status === "PROCESSING") {
          setPolling(true);
          setData({
            bid,
            results: [],
            riskScore: {
              overallScore: 0,
              riskLevel: "LOW",
              categoryBreakdown: {
                financial: { score: 0, maxScore: 20, status: "LOW" },
                technical: { score: 0, maxScore: 20, status: "LOW" },
                experience: { score: 0, maxScore: 20, status: "LOW" },
                certification: { score: 0, maxScore: 20, status: "LOW" },
                documentation: { score: 0, maxScore: 20, status: "LOW" },
              },
              topRiskDrivers: [],
              mandatoryFailures: 0,
              missingEvidenceCount: 0,
              contradictionCount: 0,
              totalRequirements: 0,
              compliantCount: 0,
              nonCompliantCount: 0,
              needsReviewCount: 0,
              qualificationStatus: "NEEDS_REVIEW",
              technicalCompliance: 0,
              financialCompliance: 0,
              experienceCompliance: 0,
              certificationCompliance: 0,
              documentationCompliance: 0,
              overallCompliance: 0,
              recommendation: "Analysis in progress...",
              compliant: 0,
              nonCompliant: 0,
              needsReview: 0,
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

  // Polling during analysis
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(fetchData, 4000);
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
      setData((prev) => (prev ? { ...prev, bid: { ...prev.bid, status: "PROCESSING" } } : prev));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReanalyzing(false);
    }
  };

  const handleOpenAuditLogs = async () => {
    setShowAuditLogs(true);
    setLoadingAudit(true);
    try {
      const res = await api.getAuditLogs(bidId);
      setAuditLogs(res.logs);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleSubmitOverride = async () => {
    if (!overrideModalResult) return;
    setSubmittingOverride(true);
    setError(null);
    try {
      await api.overrideDecision(bidId, overrideModalResult.id, {
        decision: overrideDecision,
        reason: overrideReason,
        reviewerName: activeRole === "REVIEWER" ? "Senior Audit Reviewer" : "Procurement Officer",
      });
      setOverrideModalResult(null);
      setOverrideReason("");
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleResolveContradiction = async () => {
    if (!resolvingContradiction) return;
    setSubmittingResolution(true);
    setError(null);
    try {
      await api.resolveContradiction(bidId, resolvingContradiction.id, {
        resolutionNotes,
        resolvedBy: "Procurement Officer",
      });
      setResolvingContradiction(null);
      setResolutionNotes("");
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmittingResolution(false);
    }
  };

  const handleAcceptAI = async (result: ComplianceResult) => {
    setError(null);
    try {
      await api.overrideDecision(bidId, result.id, {
        decision: (result.status as any) || "COMPLIANT",
        reason: "Accepted automated AI/Rule verification without modifications.",
        reviewerName: "Procurement Officer",
      });
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Filter & Search logic
  const filteredResults = data?.results.filter((r) => {
    const currentStatus = r.finalStatus || r.status;

    // Filter chip check
    if (filter === "COMPLIANT" && currentStatus !== "COMPLIANT") return false;
    if (filter === "NON_COMPLIANT" && currentStatus !== "NON_COMPLIANT") return false;
    if (filter === "NEEDS_REVIEW" && currentStatus !== "NEEDS_REVIEW") return false;
    if (filter === "MANDATORY" && !r.requirement.mandatory) return false;
    if (filter === "MISSING_EVIDENCE" && !r.missingEvidence) return false;
    if (filter === "CONTRADICTIONS" && !r.hasContradiction) return false;
    if (filter === "LOW_CONFIDENCE" && (r.confidence >= 0.75)) return false;

    // Category filter
    if (categoryFilter !== "ALL" && r.requirement.category !== categoryFilter) return false;

    // Search filter
    if (searchTerm.trim() !== "") {
      const q = searchTerm.toLowerCase();
      const codeMatch = r.requirement.code.toLowerCase().includes(q);
      const descMatch = r.requirement.description.toLowerCase().includes(q);
      const evMatch = r.evidence?.extractedValue.toLowerCase().includes(q);
      const docMatch = r.evidence?.document?.originalName.toLowerCase().includes(q);
      if (!codeMatch && !descMatch && !evMatch && !docMatch) return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-72px)]">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-border-default border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading procurement analysis & evidence graph...</p>
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
          <Link href="/" className="inline-block mt-4 text-accent hover:text-teal">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { bid, riskScore, contradictions = [] } = data;
  const isProcessing = bid.status === "PROCESSING";
  const isMandatoryIssue = riskScore.mandatoryFailures > 0 || (contradictions && contradictions.length > 0);

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-8 space-y-6">
      {/* Top Breadcrumb & Executive Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-default pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
            <Link href="/" className="hover:text-text-primary transition">Dashboard</Link>
            <span>/</span>
            <Link href="/bids" className="hover:text-text-primary transition">Bids</Link>
            <span>/</span>
            <span className="text-text-secondary font-mono">{bid.gemBidNumber || bid.id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-text-primary">{bid.title}</h1>
            <span
              className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                bid.status === "ANALYZED"
                  ? "bg-success-bg text-success border border-success-border"
                  : bid.status === "PROCESSING"
                  ? "bg-warning-bg text-warning border border-warning-border animate-pulse"
                  : "bg-danger-bg text-danger border border-danger-border"
              }`}
            >
              {bid.status}
            </span>
          </div>
          {bid.description && <p className="text-sm text-text-secondary mt-1 max-w-3xl">{bid.description}</p>}
        </div>

        {/* Action Buttons & Role Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Role switcher */}
          <div className="flex items-center bg-bg-secondary p-1 rounded-xl border border-border-default">
            <span className="text-[11px] text-text-muted px-2 font-medium">Role:</span>
            {(["PROCUREMENT_OFFICER", "REVIEWER", "AUDITOR"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setActiveRole(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  activeRole === r
                    ? "bg-accent text-white shadow"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {r === "PROCUREMENT_OFFICER" ? "Officer" : r === "REVIEWER" ? "Reviewer" : "Auditor"}
              </button>
            ))}
          </div>

          <button
            onClick={handleOpenAuditLogs}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-bg-secondary hover:bg-bg-tertiary border border-border-default text-text-secondary hover:text-text-primary transition flex items-center gap-1.5"
          >
            <span>📜</span> Audit Trail
          </button>

          <button
            onClick={handleReanalyze}
            disabled={reanalyzing || isProcessing}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-bg-secondary hover:bg-bg-tertiary border border-border-default text-text-secondary hover:text-text-primary transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>🔄</span> {reanalyzing ? "Re-evaluating..." : "Re-run Analysis"}
          </button>

          <button
            onClick={handleDownloadReport}
            disabled={downloadingReport || isProcessing}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-accent hover:bg-accent-light text-white shadow-lg shadow-accent/20 transition flex items-center gap-2 disabled:opacity-50"
          >
            <span>📄</span> {downloadingReport ? "Generating..." : "Download Audit PDF"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger-bg border border-danger-border text-danger text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-danger font-bold text-xs">✕</button>
        </div>
      )}

      {/* Mandatory Issue Alert Banner (Strict Auto-Qualification Blocker) */}
      {isMandatoryIssue ? (
        <div className="rounded-2xl p-5 bg-gradient-to-r from-danger-bg to-red-950/40 border-2 border-danger-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-danger/10">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <div className="text-sm font-black text-danger uppercase tracking-wider flex items-center gap-2">
                MANDATORY ISSUE DETECTED — AUTOMATED QUALIFICATION BLOCKED
              </div>
              <p className="text-xs text-text-primary mt-1">
                This bid contains{" "}
                <strong className="text-danger font-bold">
                  {riskScore.mandatoryFailures} mandatory failure(s) or missing critical evidence
                </strong>{" "}
                and <strong className="text-warning font-bold">{contradictions.length} cross-document contradiction(s)</strong>.
                Under GeM rules, the system strictly forbids automatic qualification. Human officer review and verification is required.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilter("MANDATORY")}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-danger text-white hover:bg-red-600 transition shrink-0 shadow"
          >
            Inspect Critical Issues
          </button>
        </div>
      ) : (
        <div className="rounded-2xl p-4 bg-success-bg border border-success-border flex items-center gap-3">
          <span className="text-xl">✅</span>
          <div className="text-xs text-text-primary">
            <strong className="text-success font-bold">ALL MANDATORY REQUIREMENTS SATISFIED:</strong> No blocking mandatory failures or cross-document discrepancies detected. Subject to officer final verification.
          </div>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div
          onClick={() => setFilter("ALL")}
          className={`card-base p-4 cursor-pointer transition ${filter === "ALL" ? "border-accent ring-1 ring-accent" : ""}`}
        >
          <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider">Total</span>
          <div className="text-2xl font-black text-text-primary mt-1">{riskScore.totalRequirements}</div>
          <span className="text-[10px] text-text-secondary">Requirements</span>
        </div>

        <div
          onClick={() => setFilter("COMPLIANT")}
          className={`card-base p-4 cursor-pointer transition ${filter === "COMPLIANT" ? "border-success ring-1 ring-success" : ""}`}
        >
          <span className="text-[11px] text-success uppercase font-bold tracking-wider">Compliant</span>
          <div className="text-2xl font-black text-success mt-1">{riskScore.compliantCount}</div>
          <span className="text-[10px] text-text-secondary">Verified</span>
        </div>

        <div
          onClick={() => setFilter("NEEDS_REVIEW")}
          className={`card-base p-4 cursor-pointer transition ${filter === "NEEDS_REVIEW" ? "border-warning ring-1 ring-warning" : ""}`}
        >
          <span className="text-[11px] text-warning uppercase font-bold tracking-wider">Needs Review</span>
          <div className="text-2xl font-black text-warning mt-1">{riskScore.needsReviewCount}</div>
          <span className="text-[10px] text-text-secondary">Pending Human</span>
        </div>

        <div
          onClick={() => setFilter("NON_COMPLIANT")}
          className={`card-base p-4 cursor-pointer transition ${filter === "NON_COMPLIANT" ? "border-danger ring-1 ring-danger" : ""}`}
        >
          <span className="text-[11px] text-danger uppercase font-bold tracking-wider">Non-Compliant</span>
          <div className="text-2xl font-black text-danger mt-1">{riskScore.nonCompliantCount}</div>
          <span className="text-[10px] text-text-secondary">Deficiencies</span>
        </div>

        <div
          onClick={() => setFilter("MANDATORY")}
          className={`card-base p-4 cursor-pointer transition ${filter === "MANDATORY" ? "border-red-500 ring-1 ring-red-500" : ""}`}
        >
          <span className="text-[11px] text-red-400 uppercase font-bold tracking-wider">Mandatory Failures</span>
          <div className="text-2xl font-black text-red-400 mt-1">{riskScore.mandatoryFailures}</div>
          <span className="text-[10px] text-text-secondary">Critical Blockers</span>
        </div>

        <div
          onClick={() => setFilter("MISSING_EVIDENCE")}
          className={`card-base p-4 cursor-pointer transition ${filter === "MISSING_EVIDENCE" ? "border-amber-400 ring-1 ring-amber-400" : ""}`}
        >
          <span className="text-[11px] text-amber-400 uppercase font-bold tracking-wider">Missing Evidence</span>
          <div className="text-2xl font-black text-amber-400 mt-1">{riskScore.missingEvidenceCount}</div>
          <span className="text-[10px] text-text-secondary">Unsubstantiated</span>
        </div>

        <div
          onClick={() => setFilter("CONTRADICTIONS")}
          className={`card-base p-4 cursor-pointer transition ${filter === "CONTRADICTIONS" ? "border-purple-400 ring-1 ring-purple-400" : ""}`}
        >
          <span className="text-[11px] text-purple-400 uppercase font-bold tracking-wider">Contradictions</span>
          <div className="text-2xl font-black text-purple-400 mt-1">{contradictions.length}</div>
          <span className="text-[10px] text-text-secondary">Discrepancies</span>
        </div>
      </div>

      {/* Risk Engine & Executive Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Score & Category Penalties Card */}
        <div className="card-base p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              Explainable Risk Engine
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                riskScore.riskLevel === "HIGH"
                  ? "bg-danger-bg text-danger border border-danger-border"
                  : riskScore.riskLevel === "MEDIUM"
                  ? "bg-warning-bg text-warning border border-warning-border"
                  : "bg-success-bg text-success border border-success-border"
              }`}
            >
              {riskScore.riskLevel} RISK
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-text-primary">{riskScore.overallScore}</span>
            <span className="text-text-muted text-sm font-semibold">/ 100 Risk Score</span>
          </div>

          {/* 5-Category Breakdown */}
          <div className="space-y-2.5 pt-2">
            <span className="text-[11px] text-text-muted uppercase font-bold tracking-wider">
              Category Risk Deductions (20 Max Each)
            </span>
            {[
              { label: "Financial Solvency", item: riskScore.categoryBreakdown?.financial },
              { label: "Technical Specifications", item: riskScore.categoryBreakdown?.technical },
              { label: "Track Record & Experience", item: riskScore.categoryBreakdown?.experience },
              { label: "Standards & Certification", item: riskScore.categoryBreakdown?.certification },
              { label: "Legal & Tender Undertakings", item: riskScore.categoryBreakdown?.documentation },
            ].map(({ label, item }) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">{label}</span>
                  <span className="font-mono font-semibold text-text-primary">
                    {item?.score || 0}/20 pts
                  </span>
                </div>
                <div className="w-full h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (item?.score || 0) >= 14
                        ? "bg-danger"
                        : (item?.score || 0) >= 6
                        ? "bg-warning"
                        : "bg-success"
                    }`}
                    style={{ width: `${((item?.score || 0) / 20) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Risk Drivers Card */}
        <div className="card-base p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              Priority Risk Drivers
            </h3>
            <span className="text-xs text-text-muted">Deterministic</span>
          </div>

          {riskScore.topRiskDrivers && riskScore.topRiskDrivers.length > 0 ? (
            <div className="space-y-2.5">
              {riskScore.topRiskDrivers.map((driver, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs">
                  <span className="w-4 h-4 rounded-full bg-danger/20 text-danger flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-text-secondary font-medium leading-relaxed">{driver}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-muted text-xs">
              No critical risk drivers identified. All thresholds satisfy procurement criteria.
            </div>
          )}
        </div>

        {/* AI Executive Summary Card */}
        <div className="card-base p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              Procurement Audit Brief
            </h3>
            {!summary && (
              <button
                onClick={loadSummary}
                disabled={summaryLoading}
                className="text-xs text-accent hover:text-teal font-semibold transition"
              >
                {summaryLoading ? "Generating..." : "Generate AI Brief"}
              </button>
            )}
          </div>

          <div className="text-xs text-text-secondary leading-relaxed space-y-2">
            {summary ? (
              <p className="p-3.5 rounded-xl bg-bg-secondary/70 border border-border-default italic">
                "{summary}"
              </p>
            ) : (
              <p className="text-text-muted">
                Click above to generate an executive briefing summarizing mandatory gaps, cross-document discrepancies, and recommendation rationale.
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-border-default flex items-center justify-between text-[11px] text-text-muted">
            <span>Documents Processed: {bid.documents?.length || 0}</span>
            <span>Audited By: AI + Human-in-the-Loop</span>
          </div>
        </div>
      </div>

      {/* Cross-Document Contradictions Section */}
      {contradictions.length > 0 && (
        <div className="card-base p-6 border-purple-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">⚔️</span>
              <div>
                <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider">
                  Cross-Document Contradiction Register ({contradictions.length})
                </h3>
                <p className="text-xs text-text-muted">
                  Discrepancies identified across different bidder-submitted files. Human resolution required.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contradictions.map((c) => (
              <div
                key={c.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  c.resolved
                    ? "bg-bg-secondary/40 border-border-default opacity-75"
                    : "bg-purple-950/20 border-purple-800/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 font-mono">{c.fieldName}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      c.resolved
                        ? "bg-success-bg text-success border border-success-border"
                        : "bg-danger-bg text-danger border border-danger-border"
                    }`}
                  >
                    {c.resolved ? "Resolved" : "Unresolved Conflict"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-bg-secondary border border-border-default space-y-1">
                    <span className="text-[10px] text-text-muted block truncate font-mono">
                      {c.docAName} {c.pageA ? `(p. ${c.pageA})` : ""}
                    </span>
                    <span className="font-bold text-text-primary block">{c.valueA}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-bg-secondary border border-border-default space-y-1">
                    <span className="text-[10px] text-text-muted block truncate font-mono">
                      {c.docBName} {c.pageB ? `(p. ${c.pageB})` : ""}
                    </span>
                    <span className="font-bold text-text-primary block">{c.valueB}</span>
                  </div>
                </div>

                <p className="text-[11px] text-text-secondary leading-relaxed">{c.explanation}</p>

                {c.resolved ? (
                  <div className="text-[11px] text-emerald-400 bg-emerald-950/30 p-2 rounded border border-emerald-800/40">
                    <strong>Resolution:</strong> {c.resolutionNotes} (by {c.resolvedBy})
                  </div>
                ) : (
                  <button
                    onClick={() => setResolvingContradiction(c)}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 transition"
                  >
                    Resolve Discrepancy
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Matrix Filters & Search */}
      <div className="card-base p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search by requirement code, keywords, or evidence text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-bg-secondary border border-border-default text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted whitespace-nowrap">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-bg-secondary border border-border-default text-xs text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="ALL">All Categories</option>
              <option value="FINANCIAL">Financial</option>
              <option value="EXPERIENCE">Experience</option>
              <option value="CERTIFICATION">Certification</option>
              <option value="TECHNICAL">Technical</option>
              <option value="LEGAL">Legal</option>
              <option value="DOCUMENT_VALIDITY">Document Validity</option>
              <option value="BID_SPECIFIC">Bid Specific</option>
            </select>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-default">
          {[
            { id: "ALL", label: "All Items" },
            { id: "COMPLIANT", label: "Compliant" },
            { id: "NEEDS_REVIEW", label: "Needs Review" },
            { id: "NON_COMPLIANT", label: "Non-Compliant" },
            { id: "MANDATORY", label: "Mandatory Only" },
            { id: "MISSING_EVIDENCE", label: "Missing Evidence" },
            { id: "CONTRADICTIONS", label: "Contradictions" },
            { id: "LOW_CONFIDENCE", label: "Low Confidence (<75%)" },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFilter(chip.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === chip.id
                  ? "bg-accent text-white shadow"
                  : "bg-bg-secondary text-text-secondary hover:text-text-primary border border-border-default"
              }`}
            >
              {chip.label}
            </button>
          ))}
          {filteredResults && (
            <span className="ml-auto text-xs text-text-muted">
              Showing {filteredResults.length} of {data.results.length} requirements
            </span>
          )}
        </div>
      </div>

      {/* Compliance Matrix & Evidence Graph Table */}
      <div className="card-base p-0 overflow-hidden">
        <div className="divide-y divide-border-default">
          {filteredResults && filteredResults.length > 0 ? (
            filteredResults.map((r) => {
              const isExpanded = expandedRow === r.id;
              const currentStatus = r.finalStatus || r.status;
              const isMandatory = r.requirement.mandatory;
              const hasOverride = Boolean(r.reviewedBy);

              return (
                <div key={r.id} className="transition hover:bg-bg-secondary/40">
                  {/* Row Summary */}
                  <div
                    onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-bg-secondary text-accent border border-border-default">
                          {r.requirement.code}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            isMandatory
                              ? "bg-red-950/80 text-red-300 border border-red-800"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {isMandatory ? "Mandatory" : "Optional"}
                        </span>
                        <span className="text-[10px] text-text-muted uppercase font-semibold">
                          {r.requirement.category}
                        </span>

                        {r.missingEvidence && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                            Evidence Missing
                          </span>
                        )}

                        {r.hasContradiction && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                            Contradiction
                          </span>
                        )}

                        {hasOverride && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700">
                            Officer Overridden
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-text-primary leading-snug">
                        {r.requirement.description}
                      </h4>

                      {/* Rule calculation snippet if available */}
                      {r.ruleCalculation && (
                        <div className="text-[11px] font-mono text-text-muted flex items-center gap-1.5">
                          <span className="text-accent font-bold">Calc:</span>
                          <span>{r.ruleCalculation}</span>
                        </div>
                      )}
                    </div>

                    {/* Status & Action */}
                    <div className="flex items-center gap-4 shrink-0">
                      {/* Confidence indicator */}
                      <div className="text-right hidden sm:block">
                        <span className="text-xs font-mono font-bold text-text-secondary">
                          {Math.round(r.confidence * 100)}%
                        </span>
                        <span className="text-[10px] text-text-muted block">Confidence</span>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                          currentStatus === "COMPLIANT"
                            ? "bg-success-bg text-success border-success-border glow-success"
                            : currentStatus === "NEEDS_REVIEW"
                            ? "bg-warning-bg text-warning border-warning-border glow-warning"
                            : "bg-danger-bg text-danger border-danger-border glow-danger"
                        }`}
                      >
                        {currentStatus}
                      </span>

                      <span className="text-text-muted text-xs">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded Evidence Graph & Traceability Drawer */}
                  {isExpanded && (
                    <div className="p-6 bg-bg-secondary/60 border-t border-border-default space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Evidence Citation Block */}
                        <div className="space-y-3">
                          <h5 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                            <span>🔍</span> Supporting Bidder Evidence
                          </h5>

                          {r.evidence ? (
                            <div className="p-4 rounded-xl bg-bg-secondary border border-border-default space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-text-muted">Document:</span>
                                <span className="font-mono font-bold text-accent">
                                  {r.evidence.document?.originalName || "Uploaded File"}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-xs">
                                <span className="text-text-muted">Citation Location:</span>
                                <span className="font-mono text-text-primary">
                                  Page {r.evidence.pageNumber || "1"}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-xs">
                                <span className="text-text-muted">Extracted Value:</span>
                                <span className="font-bold text-emerald-400">
                                  {r.evidence.extractedValue}
                                </span>
                              </div>

                              {r.evidence.rawText && (
                                <div className="p-3 rounded-lg bg-bg-primary border border-border-default text-xs text-text-secondary font-mono italic">
                                  "{r.evidence.rawText}"
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl bg-red-950/20 border border-red-800/40 text-xs text-red-300 space-y-1">
                              <strong>No Supporting Evidence Found</strong>
                              <p className="text-slate-400">
                                The bidder did not provide documentation matching this requirement.
                              </p>
                            </div>
                          )}

                          {/* Rule Calculation Display */}
                          {r.ruleCalculation && (
                            <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-xs space-y-1">
                              <strong className="text-indigo-300">Deterministic Arithmetic Calculation:</strong>
                              <p className="font-mono text-text-primary">{r.ruleCalculation}</p>
                            </div>
                          )}
                        </div>

                        {/* Audit & Decision Block */}
                        <div className="space-y-3">
                          <h5 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                            <span>⚖️</span> Decision Traceability
                          </h5>

                          <div className="p-4 rounded-xl bg-bg-secondary border border-border-default space-y-3 text-xs">
                            {/* AI / Rule Recommendation */}
                            <div className="space-y-1 pb-2 border-b border-border-default">
                              <div className="flex items-center justify-between">
                                <span className="text-text-muted">AI / Rule Recommendation:</span>
                                <span className="font-bold text-text-secondary">{r.status}</span>
                              </div>
                              <p className="text-text-secondary leading-relaxed">{r.reason}</p>
                            </div>

                            {/* Final Human Decision */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-text-muted">Final Human Decision:</span>
                                <span className="font-bold text-accent">{currentStatus}</span>
                              </div>
                              {r.reviewedBy && (
                                <p className="text-text-muted text-[11px]">
                                  Reviewed by {r.reviewedBy} on {new Date(r.reviewedAt || "").toLocaleDateString("en-IN")}.
                                  {r.reviewerReason && ` Rationale: "${r.reviewerReason}"`}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Reviewer Action Buttons */}
                          <div className="flex items-center gap-3 pt-2">
                            <button
                              onClick={() => handleAcceptAI(r)}
                              className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-700/50 transition"
                            >
                              ✓ Accept AI Decision
                            </button>

                            <button
                              onClick={() => {
                                setOverrideModalResult(r);
                                setOverrideDecision(currentStatus === "COMPLIANT" ? "NON_COMPLIANT" : "COMPLIANT");
                              }}
                              className="flex-1 py-2 rounded-xl text-xs font-bold bg-accent hover:bg-accent-light text-white shadow transition"
                            >
                              ✏️ Override Decision
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-10 text-center text-text-muted text-sm">
              No requirements match the active filter criteria.
            </div>
          )}
        </div>
      </div>

      {/* Decision Override Modal */}
      {overrideModalResult && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-base max-w-lg w-full p-6 space-y-4 bg-slate-900 border-slate-700">
            <div className="flex items-center justify-between border-b border-border-default pb-3">
              <h3 className="text-base font-bold text-text-primary">
                Human Reviewer Decision Override
              </h3>
              <button
                onClick={() => setOverrideModalResult(null)}
                className="text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <span className="font-mono text-accent">{overrideModalResult.requirement.code}</span>
              <p className="text-text-primary font-semibold">
                {overrideModalResult.requirement.description}
              </p>
              <p className="text-text-muted mt-1">
                Original AI Recommendation: <strong>{overrideModalResult.status}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-secondary">
                Select Final Human Decision:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["COMPLIANT", "NEEDS_REVIEW", "NON_COMPLIANT"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setOverrideDecision(s)}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      overrideDecision === s
                        ? s === "COMPLIANT"
                          ? "bg-success-bg text-success border-success"
                          : s === "NEEDS_REVIEW"
                          ? "bg-warning-bg text-warning border-warning"
                          : "bg-danger-bg text-danger border-danger"
                        : "bg-bg-secondary text-text-muted border-border-default"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-secondary">
                Officer Justification / Legal Rationale:
              </label>
              <textarea
                rows={3}
                placeholder="State specific audit reasons for overriding automated AI decision..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full p-3 rounded-xl bg-bg-secondary border border-border-default text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setOverrideModalResult(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitOverride}
                disabled={submittingOverride}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-accent hover:bg-accent-light text-white shadow"
              >
                {submittingOverride ? "Persisting..." : "Save Final Decision"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contradiction Resolution Modal */}
      {resolvingContradiction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-base max-w-lg w-full p-6 space-y-4 bg-slate-900 border-slate-700">
            <div className="flex items-center justify-between border-b border-border-default pb-3">
              <h3 className="text-base font-bold text-text-primary">Resolve Discrepancy</h3>
              <button
                onClick={() => setResolvingContradiction(null)}
                className="text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1">
              <span className="text-purple-300 font-bold">{resolvingContradiction.fieldName}</span>
              <p className="text-text-secondary">{resolvingContradiction.explanation}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-secondary">
                Officer Resolution Findings:
              </label>
              <textarea
                rows={3}
                placeholder="E.g., Bidder clarified via corrigendum that 3-year warranty applies to all server components."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full p-3 rounded-xl bg-bg-secondary border border-border-default text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setResolvingContradiction(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveContradiction}
                disabled={submittingResolution}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow"
              >
                {submittingResolution ? "Saving..." : "Mark Resolved"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Drawer */}
      {showAuditLogs && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl h-full bg-slate-950 border-l border-slate-800 p-6 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📜</span> Immutable Audit Trail
                </h3>
                <span className="text-xs text-slate-400">Verifiable chronological audit events</span>
              </div>
              <button
                onClick={() => setShowAuditLogs(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {loadingAudit ? (
                <div className="text-center py-10 text-xs text-slate-400">Loading audit history...</div>
              ) : auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-accent">{log.action}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString("en-IN")}
                      </span>
                    </div>
                    <div className="text-slate-300 text-[11px]">
                      Actor: <strong className="text-slate-200">{log.actor}</strong> ({log.actorRole})
                    </div>
                    {log.previousState && (
                      <div className="text-slate-400 text-[10px]">
                        State Changed: {log.previousState} → {log.newState}
                      </div>
                    )}
                    {log.notes && (
                      <p className="text-slate-400 text-[11px] mt-1 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                        {log.notes}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-xs text-slate-500">
                  No audit logs recorded for this bid yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
