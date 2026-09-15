import { z } from 'zod';
import { geminiJSON } from '../lib/gemini';
import { EvidenceItem, SemanticResult, ComplianceStatus } from '../types';

const GeminiComplianceSchema = z.object({
  status: z.enum(['COMPLIANT', 'NON_COMPLIANT', 'NEEDS_REVIEW']),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(5),
  matched_evidence_index: z.number(),
  interpretation: z.string().optional(),
});

type GeminiComplianceOutput = z.infer<typeof GeminiComplianceSchema>;

/**
 * Semantic compliance engine with structured Zod output validation.
 * Conservative evaluation for subjective requirements (experience, OEM auth, technical specifications).
 */
export async function evaluateWithSemantics(
  requirementDescription: string,
  requirementCategory: string,
  evidenceItems: EvidenceItem[]
): Promise<SemanticResult> {
  if (evidenceItems.length === 0) {
    return {
      status: 'NEEDS_REVIEW',
      confidence: 0.2,
      reason: 'No evidence documents submitted to evaluate this requirement. Needs procurement officer review.',
    };
  }

  const evidenceSummary = evidenceItems
    .map(
      (ev, i) =>
        `[${i}] Document: "${ev.document.originalName}" (${ev.document.docType})
     Field: ${ev.fieldName}
     Value: ${ev.extractedValue}
     Page: ${ev.pageNumber || 'unknown'}
     Raw text: ${ev.rawText ? ev.rawText.slice(0, 300) : 'N/A'}`
    )
    .join('\n\n');

  const prompt = `You are a strict government procurement compliance auditor for India's Government e-Marketplace (GeM).

TASK: Evaluate whether the bidder satisfies the specified requirement using ONLY the provided evidence.

REQUIREMENT:
"${requirementDescription}"
Category: ${requirementCategory}

AVAILABLE EVIDENCE:
${evidenceSummary}

STRICT AUDIT RULES:
1. ONLY mark "COMPLIANT" if there is explicit, undeniable, and sufficient evidence directly proving the requirement.
2. If evidence is missing, partial, expired, or ambiguous, you MUST mark "NEEDS_REVIEW". A false compliant decision is unacceptable in government procurement.
3. If the requirement is OEM Authorization and no authorized manufacturer letter is found, status MUST be "NEEDS_REVIEW" or "NON_COMPLIANT".
4. Return confidence between 0.0 and 1.0. If confidence is below 0.7, choose "NEEDS_REVIEW".

Return JSON with:
{
  "status": "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW",
  "confidence": float (0.0 to 1.0),
  "reason": "Clear explanation referencing document name and page number",
  "matched_evidence_index": integer index of best evidence (-1 if none),
  "interpretation": "Brief note on requirement interpretation"
}`;

  try {
    const result = await geminiJSON<GeminiComplianceOutput>(prompt, GeminiComplianceSchema);

    let finalStatus: ComplianceStatus = result.status;
    // Uncertainty rule: if confidence is below 0.65, fallback to NEEDS_REVIEW
    if (result.confidence < 0.65 && finalStatus === 'COMPLIANT') {
      finalStatus = 'NEEDS_REVIEW';
    }

    const matchedItem =
      result.matched_evidence_index >= 0 && result.matched_evidence_index < evidenceItems.length
        ? evidenceItems[result.matched_evidence_index]
        : undefined;

    return {
      status: finalStatus,
      confidence: Math.min(Math.max(result.confidence, 0.1), 0.99),
      reason: result.reason,
      matchedEvidenceId: matchedItem?.id,
      interpretedEvidence: result.interpretation,
    };
  } catch (error) {
    console.warn('Semantic AI evaluation safely fell back to NEEDS_REVIEW:', (error as Error).message);
    // Safe fallback rule: never error out or assume COMPLIANT, always fallback to NEEDS_REVIEW
    return {
      status: 'NEEDS_REVIEW',
      confidence: 0.5,
      reason: `Automated AI semantic evaluation requires officer verification. Supporting evidence should be manually inspected against "${requirementDescription}".`,
      matchedEvidenceId: evidenceItems[0]?.id,
    };
  }
}
