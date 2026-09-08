import { geminiJSON } from '../lib/gemini';

export interface SemanticResult {
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
  confidence: number;
  reason: string;
  matchedEvidenceId?: string;
}

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

interface GeminiComplianceResponse {
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
  confidence: number;
  reason: string;
  matched_evidence_index: number;
}

/**
 * Semantic compliance engine powered by Gemini.
 * Used for requirements that can't be evaluated with simple numeric rules,
 * such as "similar project experience" or "OEM authorization".
 */
export async function evaluateWithSemantics(
  requirementDescription: string,
  requirementCategory: string,
  evidenceItems: EvidenceItem[]
): Promise<SemanticResult> {
  if (evidenceItems.length === 0) {
    return {
      status: 'NEEDS_REVIEW',
      confidence: 0.3,
      reason: 'No evidence documents available to evaluate this requirement.',
    };
  }

  const evidenceSummary = evidenceItems.map((ev, i) => (
    `[${i}] Document: "${ev.document.originalName}" (${ev.document.docType})
     Field: ${ev.fieldName}
     Value: ${ev.extractedValue}
     Page: ${ev.pageNumber || 'unknown'}
     Raw text: ${ev.rawText || 'N/A'}`
  )).join('\n\n');

  const prompt = `You are an expert government procurement compliance analyst.

TASK: Determine whether the following bid requirement is satisfied by the available evidence.

REQUIREMENT:
"${requirementDescription}"
Category: ${requirementCategory}

AVAILABLE EVIDENCE:
${evidenceSummary}

INSTRUCTIONS:
1. Carefully assess whether the evidence sufficiently satisfies the requirement.
2. Do NOT invent or assume evidence that isn't provided.
3. If evidence is ambiguous or partially satisfies the requirement, use NEEDS_REVIEW.
4. Be conservative — a false COMPLIANT is worse than a NEEDS_REVIEW.

Return a JSON object with:
- status: "COMPLIANT" (strong evidence satisfies the requirement), "NON_COMPLIANT" (evidence clearly contradicts or falls short), or "NEEDS_REVIEW" (insufficient or ambiguous evidence)
- confidence: A float between 0.0 and 1.0
- reason: A detailed explanation of your decision (2-3 sentences). Reference specific evidence.
- matched_evidence_index: The index of the most relevant evidence item (from the list above), or -1 if none match.`;

  try {
    const result = await geminiJSON<GeminiComplianceResponse>(prompt);

    return {
      status: result.status,
      confidence: Math.min(Math.max(result.confidence, 0), 1),
      reason: result.reason,
      matchedEvidenceId: result.matched_evidence_index >= 0 && result.matched_evidence_index < evidenceItems.length
        ? evidenceItems[result.matched_evidence_index].id
        : undefined,
    };
  } catch (error) {
    console.error('Semantic evaluation error:', error);
    return {
      status: 'NEEDS_REVIEW',
      confidence: 0.2,
      reason: `Unable to perform AI evaluation. Manual review required. Error: ${(error as Error).message}`,
    };
  }
}
