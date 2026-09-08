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
  _count?: { documents: number; requirements: number; results: number };
  documents?: DocItem[];
  requirements?: Requirement[];
  results?: ComplianceResult[];
}

export interface DocItem {
  id: string;
  originalName: string;
  docType: string;
  totalPages: number | null;
  processed: boolean;
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
  sourcePage: number | null;
}

export interface Evidence {
  id: string;
  fieldName: string;
  extractedValue: string;
  pageNumber: number | null;
  confidence: number | null;
  rawText: string | null;
  document?: {
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
}

export interface RiskScore {
  technicalCompliance: number;
  financialCompliance: number;
  experienceCompliance: number;
  certificationCompliance: number;
  documentationCompliance: number;
  overallCompliance: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  mandatoryFailures: number;
  totalRequirements: number;
  compliant: number;
  nonCompliant: number;
  needsReview: number;
  recommendation: string;
}

export interface ComplianceData {
  bid: Bid;
  results: ComplianceResult[];
  riskScore: RiskScore;
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

  // Compliance
  triggerAnalysis: (bidId: string) =>
    request<{ message: string }>(`/bids/${bidId}/analyze`, { method: 'POST' }),

  getCompliance: (bidId: string) => request<ComplianceData>(`/bids/${bidId}/compliance`),

  getSummary: (bidId: string) => request<{ summary: string }>(`/bids/${bidId}/summary`),

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
    a.download = `compliance-report-${bidId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
