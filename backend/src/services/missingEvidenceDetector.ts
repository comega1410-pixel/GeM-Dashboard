import { ExtractedRequirement, EvidenceItem, MissingEvidenceCheck } from '../types';
import { findRelevantEvidence } from './ruleEngine';

/**
 * Assesses evidence presence, validity, and sufficiency for a requirement.
 */
export function evaluateEvidenceSufficiency(
  requirement: ExtractedRequirement,
  allEvidence: EvidenceItem[]
): MissingEvidenceCheck {
  const relevantEvidence = findRelevantEvidence(requirement, allEvidence);

  // 1. Evidence Missing entirely
  if (relevantEvidence.length === 0) {
    return {
      isMissing: true,
      sufficiency: 'MISSING',
      reason: requirement.mandatory
        ? `Mandatory evidence not found: No supporting documents submitted for "${requirement.description}".`
        : `Optional evidence not provided for "${requirement.description}".`,
    };
  }

  const bestEvidence = relevantEvidence[0];

  // 2. Check if evidence is explicitly flagged as contradictory
  if (bestEvidence.isContradictory) {
    return {
      isMissing: false,
      sufficiency: 'CONTRADICTORY',
      reason: `Evidence found ("${bestEvidence.extractedValue}") has conflicting declarations across documents.`,
      matchedEvidence: bestEvidence,
    };
  }

  // 3. Check for expired dates
  if (requirement.category === 'DOCUMENT_VALIDITY' || /expiry|validity|valid until/i.test(requirement.description)) {
    const rawVal = bestEvidence.extractedValue.toLowerCase();
    if (rawVal.includes('expired') || rawVal.includes('invalid')) {
      return {
        isMissing: false,
        sufficiency: 'EXPIRED',
        reason: `Evidence found ("${bestEvidence.extractedValue}") indicates the document or certification is expired or invalid.`,
        matchedEvidence: bestEvidence,
      };
    }
  }

  // 4. Check for insufficient evidence
  // E.g. extracted text is too short, uncertain, or merely a keyword mention
  const valueLength = bestEvidence.extractedValue.trim().length;
  const rawLength = (bestEvidence.rawText || '').trim().length;

  if (valueLength < 3 && rawLength < 10) {
    return {
      isMissing: true,
      sufficiency: 'INSUFFICIENT',
      reason: `Evidence found ("${bestEvidence.extractedValue}") is insufficient to satisfy requirement criteria.`,
      matchedEvidence: bestEvidence,
    };
  }

  // 5. Evidence is present and valid
  return {
    isMissing: false,
    sufficiency: 'VALID',
    reason: `Valid supporting evidence found in ${bestEvidence.document.originalName}${
      bestEvidence.pageNumber ? ` (Page ${bestEvidence.pageNumber})` : ''
    }.`,
    matchedEvidence: bestEvidence,
  };
}
