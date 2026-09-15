"use client";

import { useState } from "react";
import { api, BenchmarkSuiteResult } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function EvaluationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [data, setData] = useState<BenchmarkSuiteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunBenchmark = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.runBenchmark();
      setData(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchDemo = async () => {
    setSeedingDemo(true);
    setError(null);
    try {
      const res = await api.seedDemo();
      router.push(`/bids/${res.bidId}`);
    } catch (err) {
      setError((err as Error).message);
      setSeedingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏛️</span>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                SIH Evaluation & Empirical Benchmark Suite
              </h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Deterministic verification validation, accuracy metrics, and real-time SIH demo runner.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              ← Back to Bids
            </Link>
            <button
              onClick={handleLaunchDemo}
              disabled={seedingDemo}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition"
            >
              {seedingDemo ? "Seeding Demo..." : "🚀 Launch 1-Click SIH Demo Bid"}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* SIH Jury Showcase Banner */}
        <div className="rounded-2xl p-6 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-800/40 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-900/80 text-indigo-300 border border-indigo-700/50">
                Official SIH Benchmark Engine
              </span>
              <h2 className="text-xl font-bold text-white mt-2">
                Empirical Evaluation Against Ground-Truth Acceptance Criteria
              </h2>
              <p className="text-slate-300 text-sm mt-1 max-w-3xl">
                Measures exact accuracy across deterministic numeric rules, temporal unit normalization, missing evidence detection, cross-document contradiction detection, and mandatory failure guards.
              </p>
            </div>
            <button
              onClick={handleRunBenchmark}
              disabled={loading}
              className="px-5 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-950 flex items-center gap-2 transition shrink-0"
            >
              {loading ? "Running Tests..." : "⚡ Execute Live Benchmark Suite"}
            </button>
          </div>
        </div>

        {/* Benchmark Results */}
        {data && (
          <div className="space-y-6">
            {/* Top Score Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-medium">Overall Accuracy</span>
                <div className="text-3xl font-extrabold text-emerald-400">{data.accuracy}%</div>
                <div className="text-xs text-slate-500">
                  {data.passedTests} of {data.totalTests} tests passed
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-medium">Deterministic Rule Precision</span>
                <div className="text-3xl font-extrabold text-blue-400">
                  {data.metrics.ruleValidationAccuracy}%
                </div>
                <div className="text-xs text-slate-500">Zero tolerance for arithmetic errors</div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-medium">Contradiction Detection</span>
                <div className="text-3xl font-extrabold text-amber-400">
                  {data.metrics.contradictionDetectionAccuracy}%
                </div>
                <div className="text-xs text-slate-500">Cross-document discrepancy catch rate</div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-medium">Efficiency Gain</span>
                <div className="text-3xl font-extrabold text-purple-400">
                  {data.timeSavings.efficiencyGainFactor}
                </div>
                <div className="text-xs text-slate-500">
                  {data.timeSavings.manualReviewMinutes}m manual → {data.timeSavings.aiAssistedMinutes}m AI
                </div>
              </div>
            </div>

            {/* Time Savings Detailed Callout */}
            <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">
                  Government Procurement Productivity Impact
                </h3>
                <p className="text-slate-400 text-xs max-w-2xl">
                  Automated extraction, page-level citations, and rule verification reduce average tender scrutiny time by over 90%, freeing officers to focus on human-in-the-loop exception handling.
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-center px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xl font-bold text-amber-400">
                    {data.timeSavings.manualReviewMinutes} min
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Manual Review</div>
                </div>
                <div className="text-slate-500 font-bold">VS</div>
                <div className="text-center px-4 py-2 rounded-xl bg-indigo-950 border border-indigo-700">
                  <div className="text-xl font-bold text-indigo-400">
                    {data.timeSavings.aiAssistedMinutes} min
                  </div>
                  <div className="text-[10px] text-indigo-300 uppercase tracking-wider">GeM Copilot</div>
                </div>
                <div className="text-center px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-700">
                  <div className="text-xl font-bold text-emerald-400">
                    {data.timeSavings.hoursSavedPer100Bids} hrs
                  </div>
                  <div className="text-[10px] text-emerald-300 uppercase tracking-wider">Saved / 100 Bids</div>
                </div>
              </div>
            </div>

            {/* Scenarios Table */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Acceptance Scenario Test Results</h3>
                <span className="text-xs text-slate-400">Executed locally in milliseconds</span>
              </div>
              <div className="divide-y divide-slate-800">
                {data.scenarios.map((s) => (
                  <div key={s.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                          {s.id}
                        </span>
                        <span className="text-sm font-bold text-white">{s.name}</span>
                      </div>
                      <p className="text-xs text-slate-400">{s.description}</p>
                      <div className="text-xs text-slate-500 font-mono mt-1">
                        <span className="text-slate-400">Expected:</span> {s.expected}
                      </div>
                      <div className="text-xs text-slate-300 font-mono">
                        <span className="text-slate-400">Actual:</span> {s.actual}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs font-mono text-slate-500">{s.executionTimeMs}ms</span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          s.passed
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                            : "bg-red-950/80 text-red-300 border-red-700"
                        }`}
                      >
                        {s.passed ? "PASSED" : "FAILED"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
