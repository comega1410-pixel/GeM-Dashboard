import { geminiJSON } from '../lib/gemini';

export interface ExtractedRequirement {
  code: string;
  category: 'FINANCIAL' | 'EXPERIENCE' | 'CERTIFICATION' | 'TECHNICAL' | 'LEGAL' | 'DOCUMENT_VALIDITY' | 'BID_SPECIFIC';
  description: string;
  mandatory: boolean;
  operator?: string;
  thresholdValue?: number;
  unit?: string;
  sourcePage?: number;
}

/**
 * Extract structured requirements from a bid document's text.
 * Uses Gemini to parse tender text into structured requirement objects.
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
- unit: The unit of measurement (INR, years, units, days, etc.). Omit if not applicable.
- sourcePage: The approximate page number where this requirement appears. Use null if unknown.

Categories explained:
- FINANCIAL: Turnover, net worth, financial capacity, GST registration
- EXPERIENCE: Years of experience, similar contracts, completed projects
- CERTIFICATION: ISO, BIS, CE, product-specific certifications
- TECHNICAL: Product specifications, technical parameters
- LEGAL: Declarations, signed documents, affidavits, undertakings
- DOCUMENT_VALIDITY: Expiry dates, missing documents, certificate validity
- BID_SPECIFIC: Delivery location, delivery timeline, specific conditions

Return a JSON array of requirement objects.

BID DOCUMENT TEXT:
${bidText.slice(0, 30000)}`;

  const requirements = await geminiJSON<ExtractedRequirement[]>(prompt);

  // Ensure codes are unique
  const seen = new Set<string>();
  return requirements.map((req, i) => {
    let code = req.code || `REQ-${String(i + 1).padStart(3, '0')}`;
    if (seen.has(code)) {
      code = `REQ-${String(i + 1).padStart(3, '0')}`;
    }
    seen.add(code);
    return { ...req, code };
  });
}
