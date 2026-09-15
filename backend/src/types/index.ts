export type BidStatus = 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'ERROR';

export type RequirementCategory =
  | 'FINANCIAL'
  | 'EXPERIENCE'
  | 'CERTIFICATION'
  | 'TECHNICAL'
  | 'LEGAL'
  | 'DOCUMENT_VALIDITY'
  | 'BID_SPECIFIC';

export type DocumentType =
  | 'BID_DOCUMENT'
  | 'FINANCIAL_STATEMENT'
  | 'GST_CERTIFICATE'
  | 'EXPERIENCE_CERTIFICATE'
  | 'WORK_ORDER'
  | 'OEM_AUTHORIZATION'
  | 'ISO_CERTIFICATE'
  | 'TECHNICAL_SPEC'
  | 'AFFIDAVIT_DECLARATION'
  | 'WARRANTY_DOCUMENT'
  | 'OTHER';

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';

export type ValidationMethod = 'RULE' | 'SEMANTIC' | 'HYBRID';

export type UserRole = 'ADMIN' | 'PROCUREMENT_OFFICER' | 'REVIEWER' | 'AUDITOR';

export interface ExtractedRequirement {
  code: string;
  category: RequirementCategory;
  description: string;
  mandatory: boolean;
  operator?: string | null;
  thresholdValue?: number | null;
  unit?: string | null;
  expectedEvidenceType?: string | null;
  validationType?: ValidationMethod;
  sourcePage?: number | null;
  sourceRequirementText?: string | null;
}

export interface ExtractedEvidence {
  fieldName: string;
  extractedValue: string;
  pageNumber?: number | null;
  confidence?: number | null;
  rawText?: string | null;
  evidenceType?: string | null;
}

export interface EvidenceItem {
  id: string;
  fieldName: string;
  extractedValue: string;
  pageNumber?: number | null;
  confidence?: number | null;
  rawText?: string | null;
  evidenceType?: string | null;
  isMissing?: boolean;
  isContradictory?: boolean;
  document: {
    id?: string;
    originalName: string;
    docType: string;
  };
}

export interface RuleResult {
  status: ComplianceStatus;
  confidence: number;
  reason: string;
  calculation?: string;
  matchedEvidenceId?: string;
}

export interface SemanticResult {
  status: ComplianceStatus;
  confidence: number;
  reason: string;
  matchedEvidenceId?: string;
  interpretedEvidence?: string;
}

export interface MissingEvidenceCheck {
  isMissing: boolean;
  reason?: string;
  sufficiency: 'MISSING' | 'INSUFFICIENT' | 'VALID' | 'CONTRADICTORY' | 'EXPIRED';
  matchedEvidence?: EvidenceItem;
}

export interface ContradictionResult {
  fieldName: string;
  docAId: string;
  docAName: string;
  pageA?: number | null;
  valueA: string;
  docBId: string;
  docBName: string;
  pageB?: number | null;
  valueB: string;
  explanation: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RiskCategoryBreakdown {
  score: number;
  maxScore: number;
  status: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ExplainableRiskScore {
  overallScore: number; // 0-100 (0 = Lowest risk, 100 = Critical failure)
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
}
