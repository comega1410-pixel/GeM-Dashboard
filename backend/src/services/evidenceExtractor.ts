import { geminiJSON } from '../lib/gemini';

export interface ExtractedEvidence {
  fieldName: string;
  extractedValue: string;
  pageNumber?: number;
  confidence?: number;
  rawText?: string;
}

/**
 * Extract structured evidence from a bidder document's text.
 * Identifies key data points such as financial figures, certifications,
 * experience details, technical specifications, etc.
 */
export async function extractEvidence(
  documentText: string,
  documentName: string,
  documentType: string
): Promise<ExtractedEvidence[]> {
  const prompt = `You are an expert document analyst for government procurement.

Analyze the following bidder document and extract ALL relevant evidence items that could be used to verify compliance with bid requirements.

Document Name: ${documentName}
Document Type: ${documentType}

For each evidence item, provide:
- fieldName: A descriptive field name (e.g., "annual_turnover", "iso_certification", "years_of_experience", "delivery_timeline", "processor_spec", "ram_spec", "company_registration_date", etc.)
- extractedValue: The actual value extracted from the document (as a string)
- pageNumber: The approximate page number (use 1 if unsure)
- confidence: Your confidence in the extraction accuracy (0.0 to 1.0)
- rawText: The relevant raw text snippet from which this was extracted (keep it brief, max 200 chars)

Focus on extracting:
- Financial figures (turnover, net worth, revenue)
- Dates (registration dates, certificate validity, expiry dates)
- Certification details (type, number, issuing body, validity)
- Experience details (projects, clients, years, contract values)
- Technical specifications (product specs, parameters, measurements)
- Company details (name, registration number, GST number, PAN)
- Delivery terms (timeline, location, conditions)
- Authorization details (OEM authorization, dealer certificates)

Return a JSON array of evidence objects.

DOCUMENT TEXT:
${documentText.slice(0, 25000)}`;

  const evidence = await geminiJSON<ExtractedEvidence[]>(prompt);
  return evidence;
}
