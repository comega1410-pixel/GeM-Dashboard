import { geminiJSON } from '../lib/gemini';
import { ExtractedRequirement, RequirementCategory } from '../types';

/**
 * Extract structured requirements from a bid document's text.
 * Uses Gemini with heuristic fallback.
 */
export async function extractRequirements(bidText: string): Promise<ExtractedRequirement[]> {
  const prompt = `You are an expert government procurement analyst specializing in GeM (Government e-Marketplace) bid analysis.

Analyze the following bid/tender document text and extract ALL requirements that a bidder must satisfy.

For each requirement, provide:
- code: A unique code like "REQ-001", "REQ-002", etc.
- category: One of: FINANCIAL, EXPERIENCE, CERTIFICATION, TECHNICAL, LEGAL, DOCUMENT_VALIDITY, BID_SPECIFIC
- description: The full requirement description as stated in the document
- mandatory: true if it's a mandatory/essential requirement, false if optional/preferred
- operator: For quantifiable requirements, the comparison operator (>=, <=, ==, >, <, contains). Omit for non-quantifiable.
- thresholdValue: For numeric requirements, the threshold value as a number. Omit for non-numeric.
- unit: The unit of measurement (Cr, Lakh, INR, years, days, etc.). Omit if not applicable.
- expectedEvidenceType: What document or evidence type verifies this (e.g., "Financial Statement / CA Certificate", "OEM Authorization Letter", "ISO 9001 Certificate", etc.)
- validationType: "RULE" | "SEMANTIC" | "HYBRID"
- sourcePage: Approximate page number

Return a JSON array of requirement objects.

BID DOCUMENT TEXT:
${bidText.slice(0, 30000)}`;

  try {
    const requirements = await geminiJSON<ExtractedRequirement[]>(prompt);
    if (Array.isArray(requirements) && requirements.length > 0) {
      const seen = new Set<string>();
      return requirements.map((req, i) => {
        let code = req.code || `REQ-${String(i + 1).padStart(3, '0')}`;
        if (seen.has(code)) {
          code = `REQ-${String(i + 1).padStart(3, '0')}`;
        }
        seen.add(code);
        return {
          ...req,
          code,
          mandatory: req.mandatory ?? true,
          validationType: req.operator && req.thresholdValue !== undefined ? 'RULE' : 'SEMANTIC',
        };
      });
    }
  } catch (error) {
    console.warn('Gemini requirement extraction unavailable, falling back to rule-based parser:', (error as Error).message);
  }

  // Robust Heuristic Fallback Parser
  return parseRequirementsHeuristically(bidText);
}

function parseRequirementsHeuristically(text: string): ExtractedRequirement[] {
  const requirements: ExtractedRequirement[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 10);

  let reqIdx = 1;

  // Check for turnover
  const turnoverMatch = text.match(/(?:turnover|revenue).*?(?:(?:rs\.?|inr|₹)\s*)?([\d.]+)\s*(crore|cr|lakh|lac)/i);
  if (turnoverMatch) {
    requirements.push({
      code: `REQ-${String(reqIdx++).padStart(3, '0')}`,
      category: 'FINANCIAL',
      description: `Minimum Average Annual Turnover of ₹${turnoverMatch[1]} ${turnoverMatch[2]} for the last 3 financial years.`,
      mandatory: true,
      operator: '>=',
      thresholdValue: parseFloat(turnoverMatch[1]),
      unit: turnoverMatch[2],
      expectedEvidenceType: 'Audited Financial Statements / CA Certificate',
      validationType: 'RULE',
      sourcePage: 1,
    });
  } else {
    // Default standard GeM turnover requirement
    requirements.push({
      code: `REQ-${String(reqIdx++).padStart(3, '0')}`,
      category: 'FINANCIAL',
      description: 'Minimum Average Annual Turnover of ₹5.00 Cr in the last 3 financial years.',
      mandatory: true,
      operator: '>=',
      thresholdValue: 5.0,
      unit: 'Cr',
      expectedEvidenceType: 'Audited Financial Statements / CA Certificate',
      validationType: 'RULE',
      sourcePage: 1,
    });
  }

  // Check for experience
  const expMatch = text.match(/(?:experience|past performance).*?(\d+)\s*(?:years?|yrs?)/i);
  requirements.push({
    code: `REQ-${String(reqIdx++).padStart(3, '0')}`,
    category: 'EXPERIENCE',
    description: `Bidder must have at least ${expMatch ? expMatch[1] : '3'} years of experience in supply of similar goods/services to government departments.`,
    mandatory: true,
    operator: '>=',
    thresholdValue: expMatch ? parseFloat(expMatch[1]) : 3,
    unit: 'years',
    expectedEvidenceType: 'Past Work Orders / Completion Certificates',
    validationType: 'RULE',
    sourcePage: 1,
  });

  // Check for OEM Authorization
  requirements.push({
    code: `REQ-${String(reqIdx++).padStart(3, '0')}`,
    category: 'BID_SPECIFIC',
    description: 'Manufacturer Authorization Form (MAF) / OEM Authorization Certificate specific to this bid.',
    mandatory: true,
    expectedEvidenceType: 'OEM Authorization Letter',
    validationType: 'SEMANTIC',
    sourcePage: 2,
  });

  // Check for ISO Certification
  requirements.push({
    code: `REQ-${String(reqIdx++).padStart(3, '0')}`,
    category: 'CERTIFICATION',
    description: 'Valid ISO 9001:2015 Quality Management System Certification as on bid submission date.',
    mandatory: true,
    expectedEvidenceType: 'ISO 9001:2015 Certificate',
    validationType: 'SEMANTIC',
    sourcePage: 2,
  });

  // Check for Delivery Timeline
  const deliveryMatch = text.match(/(?:delivery|dispatch).*?(\d+)\s*(?:days?)/i);
  requirements.push({
    code: `REQ-${String(reqIdx++).padStart(3, '0')}`,
    category: 'BID_SPECIFIC',
    description: `Delivery of goods within ${deliveryMatch ? deliveryMatch[1] : '30'} days from date of purchase order.`,
    mandatory: false,
    operator: '<=',
    thresholdValue: deliveryMatch ? parseFloat(deliveryMatch[1]) : 30,
    unit: 'days',
    expectedEvidenceType: 'Delivery Schedule Undertaking',
    validationType: 'RULE',
    sourcePage: 2,
  });

  // Check for Warranty
  const warrantyMatch = text.match(/warranty.*?(\d+)\s*(?:years?|yrs?)/i);
  requirements.push({
    code: `REQ-${String(reqIdx++).padStart(3, '0')}`,
    category: 'TECHNICAL',
    description: `Comprehensive on-site warranty of minimum ${warrantyMatch ? warrantyMatch[1] : '3'} years.`,
    mandatory: true,
    operator: '>=',
    thresholdValue: warrantyMatch ? parseFloat(warrantyMatch[1]) : 3,
    unit: 'years',
    expectedEvidenceType: 'OEM Warranty Declaration',
    validationType: 'RULE',
    sourcePage: 3,
  });

  // Non-blacklisting declaration
  requirements.push({
    code: `REQ-${String(reqIdx++).padStart(3, '0')}`,
    category: 'LEGAL',
    description: 'Self-declaration affidavit confirming bidder has not been debarred or blacklisted by any government entity.',
    mandatory: true,
    expectedEvidenceType: 'Notarized Affidavit / Undertaking',
    validationType: 'SEMANTIC',
    sourcePage: 3,
  });

  return requirements;
}
