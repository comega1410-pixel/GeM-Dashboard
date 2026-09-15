import { EvidenceItem, ContradictionResult } from '../types';
import { normalizeValue } from './ruleEngine';

/**
 * Compares evidence items across documents to detect discrepancies.
 */
export function detectContradictions(allEvidence: EvidenceItem[]): ContradictionResult[] {
  const contradictions: ContradictionResult[] = [];

  // Group evidence by normalized key concepts
  const fieldBuckets: Record<string, EvidenceItem[]> = {
    company_name: [],
    gst_number: [],
    turnover: [],
    warranty: [],
    delivery_timeline: [],
    oem_name: [],
  };

  for (const item of allEvidence) {
    const fn = item.fieldName.toLowerCase();
    const val = item.extractedValue.toLowerCase();

    if (fn.includes('company') || fn.includes('bidder_name') || fn.includes('vendor')) {
      fieldBuckets.company_name.push(item);
    } else if (fn.includes('gst') || fn.includes('gstin')) {
      fieldBuckets.gst_number.push(item);
    } else if (fn.includes('turnover') || fn.includes('revenue') || fn.includes('annual_turnover')) {
      fieldBuckets.turnover.push(item);
    } else if (fn.includes('warranty') || val.includes('warranty')) {
      fieldBuckets.warranty.push(item);
    } else if (fn.includes('delivery') || fn.includes('timeline') || fn.includes('dispatch')) {
      fieldBuckets.delivery_timeline.push(item);
    } else if (fn.includes('oem') || fn.includes('manufacturer') || fn.includes('authorization')) {
      fieldBuckets.oem_name.push(item);
    }
  }

  // Cross-compare within each bucket
  for (const [category, items] of Object.entries(fieldBuckets)) {
    if (items.length < 2) continue;

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];

        // Skip if same document
        if (a.document.originalName === b.document.originalName) continue;

        const conflict = checkConflict(category, a, b);
        if (conflict) {
          // Avoid duplicate contradictions
          const existing = contradictions.find(
            (c) =>
              c.fieldName === conflict.fieldName &&
              ((c.docAName === a.document.originalName && c.docBName === b.document.originalName) ||
                (c.docAName === b.document.originalName && c.docBName === a.document.originalName))
          );

          if (!existing) {
            contradictions.push(conflict);
          }
        }
      }
    }
  }

  return contradictions;
}

function checkConflict(
  category: string,
  a: EvidenceItem,
  b: EvidenceItem
): ContradictionResult | null {
  const cleanA = a.extractedValue.trim();
  const cleanB = b.extractedValue.trim();

  if (category === 'warranty') {
    const numA = normalizeValue(cleanA);
    const numB = normalizeValue(cleanB);

    if (numA && numB && Math.abs(numA.value - numB.value) > 0.05) {
      return {
        fieldName: 'Warranty Period',
        docAId: a.document.id || 'docA',
        docAName: a.document.originalName,
        pageA: a.pageNumber,
        valueA: a.extractedValue,
        docBId: b.document.id || 'docB',
        docBName: b.document.originalName,
        pageB: b.pageNumber,
        valueB: b.extractedValue,
        explanation: `Conflicting warranty declarations: "${a.extractedValue}" in ${a.document.originalName} vs "${b.extractedValue}" in ${b.document.originalName}.`,
        severity: 'HIGH',
      };
    }
  }

  if (category === 'turnover') {
    const numA = normalizeValue(cleanA);
    const numB = normalizeValue(cleanB);

    if (numA && numB && Math.abs(numA.value - numB.value) > 100000) {
      return {
        fieldName: 'Annual Turnover',
        docAId: a.document.id || 'docA',
        docAName: a.document.originalName,
        pageA: a.pageNumber,
        valueA: a.extractedValue,
        docBId: b.document.id || 'docB',
        docBName: b.document.originalName,
        pageB: b.pageNumber,
        valueB: b.extractedValue,
        explanation: `Turnover discrepancy across submissions: "${a.extractedValue}" vs "${b.extractedValue}".`,
        severity: 'HIGH',
      };
    }
  }

  if (category === 'gst_number') {
    const gstPattern = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/i;
    const matchA = cleanA.match(gstPattern);
    const matchB = cleanB.match(gstPattern);

    if (matchA && matchB && matchA[0].toUpperCase() !== matchB[0].toUpperCase()) {
      return {
        fieldName: 'GSTIN Number',
        docAId: a.document.id || 'docA',
        docAName: a.document.originalName,
        pageA: a.pageNumber,
        valueA: matchA[0].toUpperCase(),
        docBId: b.document.id || 'docB',
        docBName: b.document.originalName,
        pageB: b.pageNumber,
        valueB: matchB[0].toUpperCase(),
        explanation: `Mismatching GST numbers detected across submitted documents.`,
        severity: 'HIGH',
      };
    }
  }

  if (category === 'delivery_timeline') {
    const numA = normalizeValue(cleanA);
    const numB = normalizeValue(cleanB);

    if (numA && numB && Math.abs(numA.value - numB.value) > 2) {
      return {
        fieldName: 'Delivery Timeline',
        docAId: a.document.id || 'docA',
        docAName: a.document.originalName,
        pageA: a.pageNumber,
        valueA: a.extractedValue,
        docBId: b.document.id || 'docB',
        docBName: b.document.originalName,
        pageB: b.pageNumber,
        valueB: b.extractedValue,
        explanation: `Inconsistent delivery timelines specified across documents.`,
        severity: 'MEDIUM',
      };
    }
  }

  return null;
}
