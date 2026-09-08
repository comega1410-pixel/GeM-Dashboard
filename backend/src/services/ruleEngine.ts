import { ExtractedRequirement } from './requirementExtractor';

interface EvidenceItem {
  id: string;
  fieldName: string;
  extractedValue: string;
  pageNumber?: number | null;
  confidence?: number | null;
  rawText?: string | null;
  document: {
    originalName: string;
    docType: string;
  };
}

export interface RuleResult {
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
  confidence: number;
  reason: string;
  matchedEvidenceId?: string;
}

/**
 * Deterministic rule engine for quantifiable requirements.
 * Handles numeric comparisons, date checks, and presence checks.
 */
export function evaluateWithRules(
  requirement: ExtractedRequirement,
  evidenceItems: EvidenceItem[]
): RuleResult | null {
  // Only handle requirements with numeric operators
  if (!requirement.operator || requirement.thresholdValue === undefined || requirement.thresholdValue === null) {
    return null; // Not a rule-based requirement, defer to semantic engine
  }

  // Find matching evidence by category/field relevance
  const relevantEvidence = findRelevantEvidence(requirement, evidenceItems);

  if (relevantEvidence.length === 0) {
    return {
      status: 'NEEDS_REVIEW',
      confidence: 0.5,
      reason: `No evidence found for requirement: ${requirement.description}`,
    };
  }

  // Try to extract a numeric value from the best evidence
  for (const evidence of relevantEvidence) {
    const numericValue = extractNumericValue(evidence.extractedValue, requirement.unit);

    if (numericValue !== null) {
      const passes = compareValues(numericValue, requirement.operator, requirement.thresholdValue);

      return {
        status: passes ? 'COMPLIANT' : 'NON_COMPLIANT',
        confidence: (evidence.confidence || 0.8) * 0.95,
        reason: passes
          ? `Extracted value (${evidence.extractedValue}) satisfies requirement (${requirement.operator} ${requirement.thresholdValue} ${requirement.unit || ''}).`
          : `Extracted value (${evidence.extractedValue}) does NOT satisfy requirement (${requirement.operator} ${requirement.thresholdValue} ${requirement.unit || ''}). Shortfall detected.`,
        matchedEvidenceId: evidence.id,
      };
    }
  }

  return {
    status: 'NEEDS_REVIEW',
    confidence: 0.4,
    reason: `Evidence found but unable to extract a numeric value for comparison against threshold ${requirement.thresholdValue} ${requirement.unit || ''}.`,
    matchedEvidenceId: relevantEvidence[0]?.id,
  };
}

function findRelevantEvidence(requirement: ExtractedRequirement, evidenceItems: EvidenceItem[]): EvidenceItem[] {
  const categoryFieldMap: Record<string, string[]> = {
    FINANCIAL: ['turnover', 'revenue', 'net_worth', 'annual', 'financial', 'gst', 'income', 'profit'],
    EXPERIENCE: ['experience', 'years', 'projects', 'contracts', 'clients', 'completed'],
    CERTIFICATION: ['iso', 'bis', 'ce', 'certificate', 'certification', 'accreditation'],
    TECHNICAL: ['processor', 'ram', 'storage', 'display', 'memory', 'speed', 'capacity', 'power', 'weight', 'dimension'],
    LEGAL: ['declaration', 'affidavit', 'undertaking', 'authorization', 'pan', 'registration'],
    DOCUMENT_VALIDITY: ['expiry', 'validity', 'valid_until', 'issued', 'date'],
    BID_SPECIFIC: ['delivery', 'location', 'timeline', 'warranty', 'payment'],
  };

  const keywords = categoryFieldMap[requirement.category] || [];
  const descLower = requirement.description.toLowerCase();

  return evidenceItems.filter((ev) => {
    const fieldLower = ev.fieldName.toLowerCase();
    const valueLower = ev.extractedValue.toLowerCase();

    // Match by category keywords
    const fieldMatch = keywords.some((kw) => fieldLower.includes(kw));

    // Match by description keywords
    const descWords = descLower.split(/\s+/);
    const descMatch = descWords.some((word) => word.length > 3 && fieldLower.includes(word));

    return fieldMatch || descMatch;
  }).sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

function extractNumericValue(value: string, unit?: string): number | null {
  // Remove common currency symbols and formatting
  let cleaned = value
    .replace(/[₹$€£¥]/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Handle crore/lakh
  const croreMatch = cleaned.match(/([\d.]+)\s*(?:crore|cr)/i);
  if (croreMatch) {
    return parseFloat(croreMatch[1]) * 10000000;
  }

  const lakhMatch = cleaned.match(/([\d.]+)\s*(?:lakh|lac|lacs)/i);
  if (lakhMatch) {
    return parseFloat(lakhMatch[1]) * 100000;
  }

  // Try to extract the first number
  const numMatch = cleaned.match(/([\d.]+)/);
  if (numMatch) {
    return parseFloat(numMatch[1]);
  }

  return null;
}

function compareValues(actual: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>=': return actual >= threshold;
    case '>': return actual > threshold;
    case '<=': return actual <= threshold;
    case '<': return actual < threshold;
    case '==': return actual === threshold;
    case '!=': return actual !== threshold;
    default: return actual >= threshold;
  }
}
