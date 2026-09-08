"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const DOC_TYPES = [
  { value: "BID_DOCUMENT", label: "📋 Bid / Tender Document" },
  { value: "FINANCIAL_STATEMENT", label: "💰 Financial Statement" },
  { value: "CERTIFICATE", label: "📜 Certificate (ISO, BIS, etc.)" },
  { value: "PURCHASE_ORDER", label: "🧾 Purchase Order" },
  { value: "AUTHORIZATION", label: "🔑 OEM Authorization" },
  { value: "TECHNICAL_SPEC", label: "⚙️ Technical Specification" },
  { value: "OTHER", label: "📎 Other" },
];

interface UploadedFile {
  file: File;
  docType: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [bidNumber, setBidNumber] = useState("");
  const [description, setDescription] = useState("");
  const [bidId, setBidId] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1: Create bid
  const handleCreateBid = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setError("");
    try {
      const bid = await api.createBid({
        title: title.trim(),
        gemBidNumber: bidNumber.trim() || undefined,
        description: description.trim() || undefined,
      });
      setBidId(bid.id);
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Step 2: Add files
  const handleFilesSelected = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const newFiles: UploadedFile[] = Array.from(selectedFiles).map((f) => ({
      file: f,
      docType: guessDocType(f.name),
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFilesSelected(e.dataTransfer.files);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateDocType = (index: number, docType: string) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, docType } : f))
    );
  };

  // Step 3: Upload & analyze
  const handleUploadAndAnalyze = async () => {
    if (!bidId || files.length === 0) return;
    setUploading(true);
    setError("");

    try {
      await api.uploadDocuments(
        bidId,
        files.map((f) => f.file),
        files.map((f) => f.docType)
      );
      setUploading(false);
      setAnalyzing(true);

      await api.triggerAnalysis(bidId);

      // Redirect to bid page — analysis runs in the background
      router.push(`/bids/${bidId}`);
    } catch (err) {
      setError((err as Error).message);
      setUploading(false);
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-8 py-10 min-h-[calc(100vh-72px)]">
      {/* Header */}
      <div className="mb-10 animate-fade-in">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">
          New Compliance <span className="text-gradient">Analysis</span>
        </h1>
        <p className="text-text-secondary">
          Upload bid and bidder documents for automated compliance verification.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-0 mb-10">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 ${
                s === step
                  ? "border-accent bg-accent text-white shadow-[0_0_20px_var(--color-accent-glow)]"
                  : s < step
                    ? "border-success bg-success text-white"
                    : "border-border-default bg-bg-secondary text-text-muted"
              }`}
            >
              {s < step ? "✓" : s}
            </div>
            {s < 3 && (
              <div
                className={`w-20 h-0.5 transition-colors duration-300 ${
                  s < step ? "bg-success" : "bg-border-default"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-danger-bg border border-danger-border rounded-xl text-danger text-sm font-medium">
          {error}
        </div>
      )}

      {/* Step 1: Bid info */}
      {step === 1 && (
        <div className="card-base animate-slide-up">
          <h2 className="text-xl font-bold mb-6">Bid Information</h2>

          <div className="mb-5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Bid Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Supply of Medical Equipment — AIIMS Delhi"
              className="w-full px-4 py-3 bg-bg-tertiary border border-border-default rounded-xl text-text-primary text-sm font-sans transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              GeM Bid Number
            </label>
            <input
              type="text"
              value={bidNumber}
              onChange={(e) => setBidNumber(e.target.value)}
              placeholder="e.g., GEM/2026/B/1234567"
              className="w-full px-4 py-3 bg-bg-tertiary border border-border-default rounded-xl text-text-primary text-sm font-sans transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full px-4 py-3 bg-bg-tertiary border border-border-default rounded-xl text-text-primary text-sm font-sans resize-y transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
            />
          </div>

          <button
            onClick={handleCreateBid}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-accent to-accent-light text-white font-semibold text-sm cursor-pointer shadow-[0_4px_15px_var(--color-accent-glow)] hover:-translate-y-0.5 hover:shadow-[0_6px_25px_var(--color-accent-glow)] active:translate-y-0 transition-all"
          >
            Continue →
          </button>
        </div>
      )}

      {/* Step 2: Upload files */}
      {step === 2 && (
        <div className="card-base animate-slide-up">
          <h2 className="text-xl font-bold mb-6">Upload Documents</h2>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all mb-6 ${
              dragOver
                ? "border-accent bg-accent/5"
                : "border-border-default bg-bg-glass hover:border-accent/50"
            }`}
          >
            <p className="text-5xl mb-4 opacity-60">📁</p>
            <p className="text-text-primary font-semibold mb-1">
              Drop PDF files here or click to browse
            </p>
            <p className="text-text-muted text-sm">
              Supports: Bid documents, financial statements, certificates, purchase orders, etc.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-3 mb-6">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-bg-tertiary border border-border-default rounded-xl"
                >
                  <span className="text-2xl">📄</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {f.file.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {(f.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <select
                    value={f.docType}
                    onChange={(e) => updateDocType(i, e.target.value)}
                    className="px-3 py-1.5 bg-bg-secondary border border-border-default rounded-lg text-xs text-text-primary font-sans appearance-none cursor-pointer focus:outline-none focus:border-accent"
                  >
                    {DOC_TYPES.map((dt) => (
                      <option key={dt.value} value={dt.value}>
                        {dt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeFile(i)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-danger hover:bg-danger-bg transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 rounded-xl bg-bg-tertiary text-text-primary font-semibold text-sm border border-border-default cursor-pointer hover:border-accent transition-all"
            >
              ← Back
            </button>
            <button
              onClick={() => files.length > 0 && setStep(3)}
              disabled={files.length === 0}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-accent to-accent-light text-white font-semibold text-sm cursor-pointer shadow-[0_4px_15px_var(--color-accent-glow)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm & Analyze */}
      {step === 3 && (
        <div className="card-base animate-slide-up">
          <h2 className="text-xl font-bold mb-6">Review & Analyze</h2>

          <div className="bg-bg-tertiary rounded-xl p-5 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Bid
            </p>
            <p className="text-text-primary font-semibold">{title}</p>
            {bidNumber && (
              <p className="text-sm text-text-secondary">{bidNumber}</p>
            )}
          </div>

          <div className="bg-bg-tertiary rounded-xl p-5 mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              Documents ({files.length})
            </p>
            <div className="space-y-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="text-text-muted">📄</span>
                  <span className="text-text-primary flex-1 truncate">
                    {f.file.name}
                  </span>
                  <span className="text-xs text-accent font-medium px-2 py-0.5 bg-accent/10 rounded-full">
                    {DOC_TYPES.find((dt) => dt.value === f.docType)?.label.replace(/^[^\s]+\s/, "") || f.docType}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              disabled={uploading || analyzing}
              className="flex-1 py-3 rounded-xl bg-bg-tertiary text-text-primary font-semibold text-sm border border-border-default cursor-pointer hover:border-accent transition-all disabled:opacity-50"
            >
              ← Back
            </button>
            <button
              onClick={handleUploadAndAnalyze}
              disabled={uploading || analyzing}
              className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-accent to-accent-light text-white font-semibold text-sm cursor-pointer shadow-[0_4px_15px_var(--color-accent-glow)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </>
              ) : analyzing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting Analysis...
                </>
              ) : (
                "🚀 Run Compliance Analysis"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function guessDocType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("bid") || lower.includes("tender") || lower.includes("gem"))
    return "BID_DOCUMENT";
  if (lower.includes("financial") || lower.includes("turnover") || lower.includes("audit"))
    return "FINANCIAL_STATEMENT";
  if (lower.includes("iso") || lower.includes("certificate") || lower.includes("cert"))
    return "CERTIFICATE";
  if (lower.includes("purchase") || lower.includes("po") || lower.includes("order"))
    return "PURCHASE_ORDER";
  if (lower.includes("oem") || lower.includes("auth"))
    return "AUTHORIZATION";
  if (lower.includes("tech") || lower.includes("spec"))
    return "TECHNICAL_SPEC";
  return "OTHER";
}
