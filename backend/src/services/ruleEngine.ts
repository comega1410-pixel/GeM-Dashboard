import { ExtractedRequirement, EvidenceItem, RuleResult, ComplianceStatus } from '../types';

/**
 * Normalizes values across Crores, Lakhs, Millions, Thousands, Durations, and raw numbers.
 */
export function normalizeValue(raw: string | number, targetUnit?: string | null): { value: number; unitDescription: string } | null {
  if (typeof raw === 'number') {
    return { value: raw, unitDescription: 'numeric' };
  }

  if (!raw || typeof raw !== 'string') return null;

  const str = raw.trim();

  // 1. Check for currency notations
  // Remove symbols: ₹, $, €, £, commas
  const cleanStr = str.replace(/[₹$€£,]/g, '').trim();

  // Crores: e.g. "7.2 Cr", "7.2 Crore", "7.2 Crores", "₹ 5 Cr"
  const croreMatch = cleanStr.match(/([\d.]+)\s*(?:crore|crores|cr\.?)/i);
  if (croreMatch) {
    const num = parseFloat(croreMatch[1]);
    if (!isNaN(num)) return { value: num * 10000000, unitDescription: '₹ (normalized from Crore)' };
  }

  // Lakhs: e.g. "50 Lakh", "50 Lacs", "50 Lakhs"
  const lakhMatch = cleanStr.match(/([\d.]+)\s*(?:lakh|lacs|lac|lakhs)/i);
  if (lakhMatch) {
    const num = parseFloat(lakhMatch[1]);
    if (!isNaN(num)) return { value: num * 100000, unitDescription: '₹ (normalized from Lakh)' };
  }

  // Millions / Billions / Thousands
  const millionMatch = cleanStr.match(/([\d.]+)\s*(?:million|mn|m)\b/i);
  if (millionMatch) {
    const num = parseFloat(millionMatch[1]);
    if (!isNaN(num)) return { value: num * 1000000, unitDescription: 'normalized from Million' };
  }

  const thousandMatch = cleanStr.match(/([\d.]+)\s*(?:thousand|k)\b/i);
  if (thousandMatch) {
    const num = parseFloat(thousandMatch[1]);
    if (!isNaN(num)) return { value: num * 1000, unitDescription: 'normalized from Thousand' };
  }

  // 2. Durations (Years, Months, Days)
  const yearsMatch = cleanStr.match(/([\d.]+)\s*(?:years?|yrs?)/i);
  if (yearsMatch) {
    const num = parseFloat(yearsMatch[1]);
    if (!isNaN(num)) return { value: num, unitDescription: 'years' };
  }

  const monthsMatch = cleanStr.match(/([\d.]+)\s*(?:months?|mos?)/i);
  if (monthsMatch) {
    const num = parseFloat(monthsMatch[1]);
    if (!isNaN(num)) return { value: num / 12, unitDescription: 'years (converted from months)' };
  }

  const daysMatch = cleanStr.match(/([\d.]+)\s*(?:days?)/i);
  if (daysMatch) {
    const num = parseFloat(daysMatch[1]);
    if (!isNaN(num)) return { value: num, unitDescription: 'days' };
  }

  // 3. Percentages
  const pctMatch = cleanStr.match(/([\d.]+)\s*%/);
  if (pctMatch) {
    const num = parseFloat(pctMatch[1]);
    if (!isNaN(num)) return { value: num, unitDescription: '%' };
  }

  // 4. Fallback: extract the first valid floating number
  const genericMatch = cleanStr.match(/[-+]?[\d.]+/);
  if (genericMatch) {
    const num = parseFloat(genericMatch[0]);
    if (!isNaN(num)) {
      // If targetUnit is 'Cr' or 'Crore' and the requirement threshold is small (e.g. 5),
      // check if the unit indicates crore
      if (targetUnit && /(?:cr|crore)/i.test(targetUnit) && num < 100000) {
        return { value: num * 10000000, unitDescription: '₹ (normalized to Cr baseline)' };
      }
      return { value: num, unitDescription: targetUnit || 'units' };
    }
  }

  return null;
}

/**
 * Normalizes threshold value based on unit (e.g. threshold = 5, unit = 'Cr' -> 50,000,000)
 */
export function normalizeThreshold(threshold: number, unit?: string | null): number {
  if (!unit) return threshold;
  const unitLower = unit.toLowerCase().trim();

  if (unitLower.includes('cr') || unitLower.includes('crore')) {
    // If threshold is already given as 5 (meaning 5 Cr), scale to base currency 50,000,000
    if (threshold < 10000) {
      return threshold * 10000000;
    }
  } else if (unitLower.includes('lakh') || unitLower.includes('lac')) {
    if (threshold < 10000) {
      return threshold * 100000;
    }
  }
  return threshold;
}

/**
 * Parses date string to timestamp for date validity/expiry comparisons.
 */
export function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();

  // Try standard Date parsing
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) return parsed;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Compares actual value against threshold using mathematical operators.
 */
export function compareValues(actual: number, operator: string, threshold: number): boolean {
  switch (operator.trim()) {
    case '>=':
      return actual >= threshold;
    case '>':
      return actual > threshold;
    case '<=':
      return actual <= threshold;
    case '<':
      return actual < threshold;
    case '==':
    case '=':
      return Math.abs(actual - threshold) < 0.0001;
    case '!=':
      return Math.abs(actual - threshold) >= 0.0001;
    default:
      return actual >= threshold;
  }
}

/**
 * Formats numbers into user-friendly currency or unit strings for calculations.
 */
export function formatReadableValue(num: number, originalUnit?: string | null): string {
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2).replace(/\.00$/, '')} Lakh`;
  }
  return `${num} ${originalUnit || ''}`.trim();
}

/**
 * Deterministic rule engine for quantifiable and date-bound requirements.
 */
export function evaluateWithRules(
  requirement: ExtractedRequirement,
  evidenceItems: EvidenceItem[],
  bidSubmissionDate?: Date
): RuleResult | null {
  const operator = requirement.operator?.trim();
  const rawThreshold = requirement.thresholdValue;

  // Check if requirement has quantifiable operator & threshold
  const isNumericRule = Boolean(operator && rawThreshold !== undefined && rawThreshold !== null);
  const isDateRule = Boolean(operator && ['DATE_AFTER', 'DATE_BEFORE', 'EXPIRES_AFTER'].includes(operator));

  if (!isNumericRule && !isDateRule) {
    return null; // Not a deterministic rule requirement, pass to semantic engine
  }

  // Find matching evidence items
  const relevantEvidence = findRelevantEvidence(requirement, evidenceItems);

  if (relevantEvidence.length === 0) {
    return {
      status: 'NEEDS_REVIEW',
      confidence: 0.9,
      reason: `No evidence found in bidder documents for requirement: "${requirement.description}". Mandatory: ${requirement.mandatory ? 'YES' : 'NO'}.`,
    };
  }

  // 1. Date comparison check
  if (isDateRule) {
    for (const evidence of relevantEvidence) {
      const dateVal = parseDateString(evidence.extractedValue);
      if (dateVal) {
        const referenceDate = bidSubmissionDate || new Date();
        let passes = false;

        if (operator === 'EXPIRES_AFTER' || operator === 'DATE_AFTER') {
          passes = dateVal.getTime() >= referenceDate.getTime();
        } else if (operator === 'DATE_BEFORE') {
          passes = dateVal.getTime() <= referenceDate.getTime();
        }

        const calcStr = `Date (${dateVal.toISOString().split('T')[0]}) ${operator} Reference (${referenceDate.toISOString().split('T')[0]})`;

        return {
          status: passes ? 'COMPLIANT' : 'NON_COMPLIANT',
          confidence: (evidence.confidence || 0.85) * 0.95,
          reason: passes
            ? `Evidence date valid: ${evidence.extractedValue} satisfies validity rule (${operator}).`
            : `Evidence date expired or invalid: ${evidence.extractedValue} fails validity rule (${operator}).`,
          calculation: calcStr,
          matchedEvidenceId: evidence.id,
        };
      }
    }
  }

  // 2. Numeric comparison check
  if (rawThreshold !== undefined && rawThreshold !== null && operator) {
    const normalizedThreshold = normalizeThreshold(rawThreshold, requirement.unit);

    for (const evidence of relevantEvidence) {
      const normalizedActual = normalizeValue(evidence.extractedValue, requirement.unit);

      if (normalizedActual !== null) {
        const passes = compareValues(normalizedActual.value, operator, normalizedThreshold);

        const actualDisplay = formatReadableValue(normalizedActual.value, requirement.unit);
        const thresholdDisplay = formatReadableValue(normalizedThreshold, requirement.unit);
        const calculation = `${actualDisplay} ${operator} ${thresholdDisplay} (${normalizedActual.value} ${operator} ${normalizedThreshold})`;

        const status: ComplianceStatus = passes ? 'COMPLIANT' : 'NON_COMPLIANT';

        return {
          status,
          confidence: Math.min(0.98, (evidence.confidence || 0.85) * 0.98),
          reason: passes
            ? `Extracted value (${evidence.extractedValue}) satisfies threshold requirement. Calculation: ${calculation}.`
            : `Extracted value (${evidence.extractedValue}) does NOT meet minimum threshold requirement. Calculation: ${calculation}. Shortfall detected.`,
          calculation,
          matchedEvidenceId: evidence.id,
        };
      }
    }
  }

  return {
    status: 'NEEDS_REVIEW',
    confidence: 0.5,
    reason: `Evidence found ("${relevantEvidence[0]?.extractedValue}") but could not be definitively converted into numeric comparison against ${rawThreshold} ${requirement.unit || ''}. Manual review required.`,
    matchedEvidenceId: relevantEvidence[0]?.id,
  };
}

/**
 * Matches relevant evidence items based on category, field keywords, and semantic tokens.
 */
export function findRelevantEvidence(
  requirement: ExtractedRequirement,
  evidenceItems: EvidenceItem[]
): EvidenceItem[] {
  const categoryFieldMap: Record<string, string[]> = {
    FINANCIAL: ['turnover', 'revenue', 'net_worth', 'annual', 'financial', 'gst', 'income', 'profit', 'balance', 'audit'],
    EXPERIENCE: ['experience', 'years', 'projects', 'contracts', 'clients', 'completed', 'work_order', 'past_performance'],
    CERTIFICATION: ['iso', 'bis', 'ce', 'certificate', 'certification', 'accreditation', 'compliance_cert'],
    TECHNICAL: ['processor', 'ram', 'storage', 'display', 'memory', 'speed', 'capacity', 'power', 'weight', 'dimension', 'spec'],
    LEGAL: ['declaration', 'affidavit', 'undertaking', 'authorization', 'pan', 'registration', 'blacklisting', 'litigation'],
    DOCUMENT_VALIDITY: ['expiry', 'validity', 'valid_until', 'issued', 'date'],
    BID_SPECIFIC: ['delivery', 'location', 'timeline', 'warranty', 'payment', 'oem', 'authorization'],
  };

  const keywords = categoryFieldMap[requirement.category] || [];
  const descLower = requirement.description.toLowerCase();

  return evidenceItems
    .filter((ev) => {
      const fieldLower = ev.fieldName.toLowerCase();
      const valueLower = ev.extractedValue.toLowerCase();

      // Direct match on category
      const fieldMatch = keywords.some((kw) => fieldLower.includes(kw));

      // Direct match on description words
      const descWords = descLower.split(/\s+/).filter((w) => w.length > 3);
      const descMatch = descWords.some((word) => fieldLower.includes(word) || valueLower.includes(word));

      return fieldMatch || descMatch;
    })
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}
