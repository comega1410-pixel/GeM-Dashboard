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

interface ComplianceItem {
  status: string;
  category: string;
  mandatory: boolean;
}

/**
 * Compute risk scores from compliance results.
 * Never auto-qualifies — any mandatory failure prevents LOW risk.
 */
export function computeRiskScore(results: ComplianceItem[]): RiskScore {
  const total = results.length;
  const compliant = results.filter((r) => r.status === 'COMPLIANT').length;
  const nonCompliant = results.filter((r) => r.status === 'NON_COMPLIANT').length;
  const needsReview = results.filter((r) => r.status === 'NEEDS_REVIEW').length;
  const mandatoryFailures = results.filter(
    (r) => r.status === 'NON_COMPLIANT' && r.mandatory
  ).length;

  // Category-level compliance
  const categoryScore = (cat: string): number => {
    const catItems = results.filter((r) => r.category === cat);
    if (catItems.length === 0) return 100;
    const catCompliant = catItems.filter((r) => r.status === 'COMPLIANT').length;
    return Math.round((catCompliant / catItems.length) * 100);
  };

  const technicalCompliance = categoryScore('TECHNICAL');
  const financialCompliance = categoryScore('FINANCIAL');
  const experienceCompliance = categoryScore('EXPERIENCE');
  const certificationCompliance = categoryScore('CERTIFICATION');
  const documentationCompliance = categoryScore('LEGAL') || categoryScore('DOCUMENT_VALIDITY');

  const overallCompliance = total > 0 ? Math.round((compliant / total) * 100) : 0;

  // Risk level — mandatory failures dominate
  let riskLevel: RiskScore['riskLevel'];
  if (mandatoryFailures >= 3) {
    riskLevel = 'CRITICAL';
  } else if (mandatoryFailures >= 1) {
    riskLevel = 'HIGH';
  } else if (needsReview >= 3 || overallCompliance < 80) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  // Recommendation
  let recommendation: string;
  if (mandatoryFailures > 0) {
    recommendation = `DO NOT AUTO-QUALIFY — ${mandatoryFailures} mandatory requirement(s) failed. Manual review required before proceeding.`;
  } else if (needsReview > 0) {
    recommendation = `${needsReview} item(s) require manual review before final qualification decision.`;
  } else {
    recommendation = `All requirements satisfied. Bidder appears compliant pending officer verification.`;
  }

  return {
    technicalCompliance,
    financialCompliance,
    experienceCompliance,
    certificationCompliance,
    documentationCompliance,
    overallCompliance,
    riskLevel,
    mandatoryFailures,
    totalRequirements: total,
    compliant,
    nonCompliant,
    needsReview,
    recommendation,
  };
}
