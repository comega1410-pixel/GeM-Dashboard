import { ExplainableRiskScore, RiskCategoryBreakdown } from '../types';

export interface ComprehensiveRiskResult extends ExplainableRiskScore {
  // Backward-compatible properties for existing components
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

export interface ComplianceResultInput {
  status: string;
  category: string;
  mandatory: boolean;
  code?: string;
  description?: string;
  reason?: string;
  missingEvidence?: boolean;
  hasContradiction?: boolean;
  ruleStatus?: string | null;
}

export interface ContradictionInput {
  fieldName: string;
  docAName: string;
  docBName: string;
  severity?: string;
}

/**
 * Deterministic Explainable Risk Scoring Engine.
 * 
 * Algorithm:
 * - 5 Dimensions: Financial, Technical, Experience, Certification, Documentation (20 points each = 100 max risk)
 * - Category score accumulates risk penalty:
 *   - Non-compliant mandatory: +20 risk penalty (critical)
 *   - Non-compliant optional: +10 risk penalty
 *   - Missing mandatory evidence: +18 risk penalty
 *   - Contradiction in category: +15 risk penalty
 *   - Needs review item: +8 risk penalty
 * - Clamped at 20 max risk per category.
 * - Overall Risk Score = Sum of 5 categories (0 = Pristine / No Risk, 100 = Maximum Risk).
 * - Risk Level:
 *   - Score >= 50 or any Mandatory Failure: HIGH
 *   - Score >= 20: MEDIUM
 *   - Score < 20: LOW
 */
export function computeRiskScore(
  results: ComplianceResultInput[],
  contradictions: ContradictionInput[] = []
): ComprehensiveRiskResult {
  const total = results.length;
  const compliant = results.filter((r) => r.status === 'COMPLIANT').length;
  const nonCompliant = results.filter((r) => r.status === 'NON_COMPLIANT').length;
  const needsReview = results.filter((r) => r.status === 'NEEDS_REVIEW').length;

  const mandatoryFailures = results.filter(
    (r) => (r.status === 'NON_COMPLIANT' || r.missingEvidence) && r.mandatory
  ).length;

  const missingEvidenceCount = results.filter((r) => r.missingEvidence).length;
  const contradictionCount = contradictions.length;

  // Evaluate risk per category (0-20 risk points, where 0 = perfect compliance, 20 = full failure)
  function evaluateCategoryRisk(catNames: string[]): RiskCategoryBreakdown {
    const items = results.filter((r) => catNames.includes(r.category));
    if (items.length === 0) {
      return { score: 0, maxScore: 20, status: 'LOW' };
    }

    let riskPoints = 0;

    for (const item of items) {
      if (item.status === 'NON_COMPLIANT') {
        riskPoints += item.mandatory ? 20 : 10;
      } else if (item.missingEvidence) {
        riskPoints += item.mandatory ? 18 : 8;
      } else if (item.hasContradiction) {
        riskPoints += 15;
      } else if (item.status === 'NEEDS_REVIEW') {
        riskPoints += 8;
      }
    }

    const finalCategoryRisk = Math.min(20, Math.round(riskPoints));
    let status: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (finalCategoryRisk >= 14) status = 'HIGH';
    else if (finalCategoryRisk >= 6) status = 'MEDIUM';

    return {
      score: finalCategoryRisk,
      maxScore: 20,
      status,
    };
  }

  const financial = evaluateCategoryRisk(['FINANCIAL']);
  const technical = evaluateCategoryRisk(['TECHNICAL']);
  const experience = evaluateCategoryRisk(['EXPERIENCE']);
  const certification = evaluateCategoryRisk(['CERTIFICATION']);
  const documentation = evaluateCategoryRisk(['LEGAL', 'DOCUMENT_VALIDITY', 'BID_SPECIFIC']);

  const overallScore = financial.score + technical.score + experience.score + certification.score + documentation.score;

  // Determine Risk Level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  if (mandatoryFailures > 0 || contradictionCount > 0 || overallScore >= 50) {
    riskLevel = 'HIGH';
  } else if (overallScore >= 20 || needsReview >= 2) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  // Derive Top Risk Drivers (deterministic, priority-ordered)
  const topRiskDrivers: string[] = [];

  // 1. Mandatory failures
  for (const item of results) {
    if (item.mandatory && item.status === 'NON_COMPLIANT') {
      topRiskDrivers.push(`Mandatory requirement failed: ${item.description || item.code || 'Requirement'}`);
    }
  }

  // 2. Missing mandatory evidence
  for (const item of results) {
    if (item.mandatory && item.missingEvidence) {
      topRiskDrivers.push(`Mandatory evidence missing: ${item.description || item.code || 'Evidence required'}`);
    }
  }

  // 3. Contradictions
  for (const c of contradictions) {
    topRiskDrivers.push(`Contradiction detected: ${c.fieldName} discrepancy between ${c.docAName} and ${c.docBName}`);
  }

  // 4. Other items needing review
  for (const item of results) {
    if (item.status === 'NEEDS_REVIEW' && !topRiskDrivers.some((d) => d.includes(item.description || ''))) {
      topRiskDrivers.push(`Officer verification required: ${item.description || item.code || 'Item'}`);
    }
  }

  // Qualification status
  let qualificationStatus: ExplainableRiskScore['qualificationStatus'];
  let recommendation: string;

  if (mandatoryFailures > 0 || contradictionCount > 0) {
    qualificationStatus = 'MANDATORY_REVIEW_REQUIRED';
    recommendation = `MANDATORY ISSUE DETECTED — HUMAN REVIEW REQUIRED. System blocks automated qualification due to ${mandatoryFailures} mandatory failure(s) / ${contradictionCount} contradiction(s).`;
  } else if (needsReview > 0) {
    qualificationStatus = 'NEEDS_REVIEW';
    recommendation = `${needsReview} requirement(s) require manual officer review before qualification decision.`;
  } else {
    qualificationStatus = 'QUALIFIED';
    recommendation = 'All evaluated criteria satisfied. Bidder conditionally meets requirements pending final officer sign-off.';
  }

  // Compliance percentage (inverse of risk for backward compatibility: 100 - (risk / 20 * 100))
  const toCompliancePct = (catScore: number) => Math.max(0, Math.round(((20 - catScore) / 20) * 100));

  return {
    overallScore,
    riskLevel,
    categoryBreakdown: {
      financial,
      technical,
      experience,
      certification,
      documentation,
    },
    topRiskDrivers: topRiskDrivers.slice(0, 6),
    mandatoryFailures,
    missingEvidenceCount,
    contradictionCount,
    totalRequirements: total,
    compliantCount: compliant,
    nonCompliantCount: nonCompliant,
    needsReviewCount: needsReview,
    qualificationStatus,

    // Backward compatibility fields
    technicalCompliance: toCompliancePct(technical.score),
    financialCompliance: toCompliancePct(financial.score),
    experienceCompliance: toCompliancePct(experience.score),
    certificationCompliance: toCompliancePct(certification.score),
    documentationCompliance: toCompliancePct(documentation.score),
    overallCompliance: total > 0 ? Math.round((compliant / total) * 100) : 0,
    recommendation,
    compliant,
    nonCompliant,
    needsReview,
  };
}
