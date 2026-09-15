import { evaluateWithRules, normalizeValue } from '../services/ruleEngine';
import { evaluateEvidenceSufficiency } from '../services/missingEvidenceDetector';
import { detectContradictions } from '../services/contradictionEngine';
import { computeRiskScore } from '../services/riskScorer';
import { ExtractedRequirement, EvidenceItem } from '../types';

describe('GeM Compliance Copilot — Core Verification Engines', () => {
  describe('Deterministic Rule Engine (Scenarios A, B, C)', () => {
    const turnoverReq: ExtractedRequirement = {
      code: 'REQ-001',
      category: 'FINANCIAL',
      description: 'Minimum Average Annual Turnover of ₹5.00 Cr',
      mandatory: true,
      operator: '>=',
      thresholdValue: 5.0,
      unit: 'Cr',
    };

    it('Scenario A: Passes when actual turnover (₹7.2 Cr) exceeds threshold (₹5.0 Cr)', () => {
      const evidence: EvidenceItem[] = [
        {
          id: 'ev-1',
          fieldName: 'annual_turnover',
          extractedValue: '₹7.2 Cr',
          document: { originalName: 'Audit_Report.pdf', docType: 'FINANCIAL_STATEMENT' },
        },
      ];

      const result = evaluateWithRules(turnoverReq, evidence);
      expect(result).not.toBeNull();
      expect(result?.status).toBe('COMPLIANT');
      expect(result?.calculation).toContain('7.2');
      expect(result?.calculation).toContain('5');
    });

    it('Scenario B: Fails when actual turnover (₹2.1 Cr) is below threshold (₹5.0 Cr)', () => {
      const evidence: EvidenceItem[] = [
        {
          id: 'ev-2',
          fieldName: 'annual_turnover',
          extractedValue: '₹2.1 Cr',
          document: { originalName: 'Audit_Report.pdf', docType: 'FINANCIAL_STATEMENT' },
        },
      ];

      const result = evaluateWithRules(turnoverReq, evidence);
      expect(result).not.toBeNull();
      expect(result?.status).toBe('NON_COMPLIANT');
      expect(result?.reason).toContain('does NOT meet minimum threshold');
    });

    it('Normalizes Lakhs to Crores correctly (e.g. 50 Lakh is 0.5 Cr < 5 Cr)', () => {
      const evidence: EvidenceItem[] = [
        {
          id: 'ev-3',
          fieldName: 'annual_turnover',
          extractedValue: '50 Lakhs',
          document: { originalName: 'Audit_Report.pdf', docType: 'FINANCIAL_STATEMENT' },
        },
      ];

      const result = evaluateWithRules(turnoverReq, evidence);
      expect(result).not.toBeNull();
      expect(result?.status).toBe('NON_COMPLIANT');
    });

    it('Normalizes time units (36 months >= 2 years)', () => {
      const expReq: ExtractedRequirement = {
        code: 'REQ-002',
        category: 'EXPERIENCE',
        description: 'Minimum 2 years experience',
        mandatory: true,
        operator: '>=',
        thresholdValue: 2,
        unit: 'years',
      };

      const evidence: EvidenceItem[] = [
        {
          id: 'ev-4',
          fieldName: 'experience',
          extractedValue: '36 months',
          document: { originalName: 'Cert.pdf', docType: 'EXPERIENCE_CERTIFICATE' },
        },
      ];

      const result = evaluateWithRules(expReq, evidence);
      expect(result).not.toBeNull();
      expect(result?.status).toBe('COMPLIANT');
    });
  });

  describe('Missing Evidence Detection (Scenario C)', () => {
    it('Identifies missing mandatory evidence for OEM Authorization', () => {
      const req: ExtractedRequirement = {
        code: 'REQ-003',
        category: 'BID_SPECIFIC',
        description: 'Manufacturer Authorization Form (MAF) from OEM',
        mandatory: true,
      };

      const check = evaluateEvidenceSufficiency(req, []);
      expect(check.isMissing).toBe(true);
      expect(check.sufficiency).toBe('MISSING');
      expect(check.reason).toContain('Mandatory evidence not found');
    });
  });

  describe('Contradiction Detection Engine (Scenario D)', () => {
    it('Detects conflicting warranty declarations across two documents', () => {
      const evidence: EvidenceItem[] = [
        {
          id: 'ev-w1',
          fieldName: 'warranty_period',
          extractedValue: '3 years',
          pageNumber: 2,
          document: { id: 'doc-1', originalName: 'Technical_Spec.pdf', docType: 'TECHNICAL_SPEC' },
        },
        {
          id: 'ev-w2',
          fieldName: 'warranty_period',
          extractedValue: '1 year',
          pageNumber: 4,
          document: { id: 'doc-2', originalName: 'Bidder_Dossier.pdf', docType: 'OTHER' },
        },
      ];

      const contradictions = detectContradictions(evidence);
      expect(contradictions.length).toBeGreaterThan(0);
      expect(contradictions[0].fieldName).toBe('Warranty Period');
      expect(contradictions[0].docAName).toBe('Technical_Spec.pdf');
      expect(contradictions[0].docBName).toBe('Bidder_Dossier.pdf');
    });

    it('Detects conflicting GSTIN numbers across submissions', () => {
      const evidence: EvidenceItem[] = [
        {
          id: 'ev-g1',
          fieldName: 'gst_number',
          extractedValue: '27AAAAA0000A1Z5',
          document: { id: 'doc-1', originalName: 'GST_Cert.pdf', docType: 'GST_CERTIFICATE' },
        },
        {
          id: 'ev-g2',
          fieldName: 'gst_number',
          extractedValue: '07BBBBB1111B2Z8',
          document: { id: 'doc-2', originalName: 'Invoice.pdf', docType: 'FINANCIAL_STATEMENT' },
        },
      ];

      const contradictions = detectContradictions(evidence);
      expect(contradictions.length).toBeGreaterThan(0);
      expect(contradictions[0].fieldName).toBe('GSTIN Number');
    });
  });

  describe('Explainable Risk Scorer & Mandatory Blocking (Scenario G)', () => {
    it('Blocks automated qualification when any mandatory requirement fails', () => {
      const results = [
        { status: 'COMPLIANT', category: 'FINANCIAL', mandatory: true },
        { status: 'NON_COMPLIANT', category: 'BID_SPECIFIC', mandatory: true, description: 'Missing OEM Form' },
      ];

      const risk = computeRiskScore(results);
      expect(risk.mandatoryFailures).toBe(1);
      expect(risk.qualificationStatus).toBe('MANDATORY_REVIEW_REQUIRED');
      expect(risk.recommendation).toContain('MANDATORY ISSUE DETECTED — HUMAN REVIEW REQUIRED');
      expect(risk.topRiskDrivers.length).toBeGreaterThan(0);
    });

    it('Computes category risk breakdown out of 20 points', () => {
      const results = [
        { status: 'NON_COMPLIANT', category: 'FINANCIAL', mandatory: true },
        { status: 'COMPLIANT', category: 'TECHNICAL', mandatory: true },
      ];

      const risk = computeRiskScore(results);
      expect(risk.categoryBreakdown.financial.score).toBe(20);
      expect(risk.categoryBreakdown.technical.score).toBe(0);
      expect(risk.overallScore).toBeGreaterThanOrEqual(20);
    });
  });
});
