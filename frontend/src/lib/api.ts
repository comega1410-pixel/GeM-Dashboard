const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

// ── Bids ──────────────────────────────────────────
export interface Bid {
  id: string;
  title: string;
  gemBidNumber: string | null;
  description: string | null;
  status: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'ERROR';
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number; requirements: number; results: number; contradictions?: number };
  documents?: DocItem[];
  requirements?: Requirement[];
  results?: ComplianceResult[];
  contradictions?: Contradiction[];
}

export interface DocItem {
  id: string;
  originalName: string;
  docType: string;
  totalPages: number | null;
  processed: boolean;
  ocrRequired?: boolean;
  extractionConfidence?: number | null;
  userCorrected?: boolean;
  correctedDocType?: string | null;
  createdAt: string;
}

export interface Requirement {
  id: string;
  code: string;
  category: string;
  description: string;
  mandatory: boolean;
  operator: string | null;
  thresholdValue: number | null;
  unit: string | null;
  expectedEvidenceType?: string | null;
  validationType?: string | null;
  sourcePage: number | null;
  sourceRequirementText?: string | null;
}

export interface Evidence {
  id: string;
  fieldName: string;
  extractedValue: string;
  pageNumber: number | null;
  confidence: number | null;
  rawText: string | null;
  evidenceType?: string | null;
  isMissing?: boolean;
  isContradictory?: boolean;
  document?: {
    id?: string;
    originalName: string;
    docType: string;
  };
}

export interface ComplianceResult {
  id: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
  confidence: number;
  reason: string;
  explanation: string | null;
  requirement: Requirement;
  evidence: Evidence | null;

  validationMethod?: 'RULE' | 'SEMANTIC' | 'HYBRID';
  ruleStatus?: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' | null;
  ruleCalculation?: string | null;
  aiStatus?: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' | null;
  aiConfidence?: number | null;
  aiReasoning?: string | null;

  missingEvidence?: boolean;
  hasContradiction?: boolean;
  isMandatoryIssue?: boolean;

  finalStatus?: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
  reviewedBy?: string | null;
  reviewerDecision?: string | null;
  reviewerReason?: string | null;
  reviewedAt?: string | null;
}

export interface Contradiction {
  id: string;
  fieldName: string;
  docAId: string;
  docAName: string;
  pageA: number | null;
  valueA: string;
  docBId: string;
  docBName: string;
  pageB: number | null;
  valueB: string;
  explanation: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  resolved: boolean;
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
}

export interface RiskCategoryBreakdown {
  score: number;
  maxScore: number;
  status: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ExplainableRiskScore {
  overallScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  categoryBreakdown: {
    financial: RiskCategoryBreakdown;
    technical: RiskCategoryBreakdown;
    experience: RiskCategoryBreakdown;
    certification: RiskCategoryBreakdown;
    documentation: RiskCategoryBreakdown;
  };
  topRiskDrivers: string[];
  mandatoryFailures: number;
  missingEvidenceCount: number;
  contradictionCount: number;
  totalRequirements: number;
  compliantCount: number;
  nonCompliantCount: number;
  needsReviewCount: number;
  qualificationStatus: 'QUALIFIED' | 'DISQUALIFIED' | 'MANDATORY_REVIEW_REQUIRED' | 'NEEDS_REVIEW';

  // Backward compatibility
  technicalCompliance: number;
  financialCompliance: number;
  experienceCompliance: number;
  certificationCompliance: number;
  documentationCompliance: number;
  overallCompliance: number;
  recommendation: string;
  compliant: number;
  nonCompliant: number;
  needsReview: number;
}

export interface AuditLogItem {
  id: string;
  action: string;
  actor: string;
  actorRole: string;
  entityType?: string | null;
  entityId?: string | null;
  previousState?: string | null;
  newState?: string | null;
  notes?: string | null;
  timestamp: string;
}

export interface ComplianceData {
  bid: Bid;
  results: ComplianceResult[];
  contradictions?: Contradiction[];
  riskScore: ExplainableRiskScore;
}

export interface BenchmarkSuiteResult {
  title: string;
  totalTests: number;
  passedTests: number;
  accuracy: number;
  metrics: {
    requirementExtractionAccuracy: number;
    ruleValidationAccuracy: number;
    citationAccuracy: number;
    missingEvidenceAccuracy: number;
    contradictionDetectionAccuracy: number;
  };
  timeSavings: {
    manualReviewMinutes: number;
    aiAssistedMinutes: number;
    efficiencyGainFactor: string;
    hoursSavedPer100Bids: number;
  };
  scenarios: Array<{
    id: string;
    name: string;
    description: string;
    passed: boolean;
    expected: string;
    actual: string;
    executionTimeMs: number;
  }>;
}

export const api = {
  // Bids
  createBid: (data: { title: string; gemBidNumber?: string; description?: string }) =>
    request<Bid>('/bids', { method: 'POST', body: JSON.stringify(data) }),

  listBids: () => request<Bid[]>('/bids'),

  getBid: (id: string) => request<Bid>(`/bids/${id}`),

  deleteBid: (id: string) => request<void>(`/bids/${id}`, { method: 'DELETE' }),

  // Documents
  uploadDocuments: async (bidId: string, files: File[], docTypes: string[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('docTypes', JSON.stringify(docTypes));

    const res = await fetch(`${API_BASE}/bids/${bidId}/documents`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || 'Upload failed');
    }

    return res.json();
  },

  listDocuments: (bidId: string) => request<DocItem[]>(`/bids/${bidId}/documents`),

  updateDocType: (bidId: string, docId: string, docType: string) =>
    request<{ message: string; document: DocItem }>(`/bids/${bidId}/documents/${docId}/type`, {
      method: 'PATCH',
      body: JSON.stringify({ docType }),
    }),

  // Compliance
  triggerAnalysis: (bidId: string) =>
    request<{ message: string }>(`/bids/${bidId}/analyze`, { method: 'POST' }),

  getCompliance: (bidId: string) => request<ComplianceData>(`/bids/${bidId}/compliance`),

  getSummary: (bidId: string) => request<{ summary: string }>(`/bids/${bidId}/summary`),

  // Human Review & Audit
  overrideDecision: (
    bidId: string,
    resultId: string,
    data: { decision: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW'; reason?: string; reviewerName?: string }
  ) =>
    request<{ message: string; result: ComplianceResult }>(`/bids/${bidId}/review/${resultId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  resolveContradiction: (
    bidId: string,
    contradictionId: string,
    data: { resolutionNotes: string; resolvedBy?: string }
  ) =>
    request<{ message: string; contradiction: Contradiction }>(`/bids/${bidId}/contradictions/${contradictionId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAuditLogs: (bidId: string) => request<{ logs: AuditLogItem[] }>(`/bids/${bidId}/audit`),

  // Benchmark & Demo
  runBenchmark: () => request<BenchmarkSuiteResult>('/benchmark/run'),

  seedDemo: () => request<{ message: string; bidId: string; title: string }>('/benchmark/seed-demo', { method: 'POST' }),

  // PDF Report
  downloadReport: async (bidId: string) => {
    const res = await fetch(`${API_BASE}/bids/${bidId}/report`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || 'Report generation failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GeM-Compliance-Audit-Report-${bidId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
