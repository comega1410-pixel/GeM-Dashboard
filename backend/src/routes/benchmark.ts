import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { runEmpiricalBenchmark } from '../services/benchmarkService';
import { logAuditEvent } from '../services/auditLogger';

const router = Router();

// Run empirical benchmark evaluation suite
router.get('/run', async (_req: Request, res: Response) => {
  try {
    const results = runEmpiricalBenchmark();
    res.json(results);
  } catch (error) {
    console.error('Benchmark execution error:', error);
    res.status(500).json({ error: 'Failed to run benchmark suite' });
  }
});

// Seed an instant SIH Demo bid with ground truth data for live presentation
router.post('/seed-demo', async (req: Request, res: Response) => {
  try {
    const title = 'GeM/2026/B/89412 — High-Performance Server & Storage Infrastructure';
    const gemBidNumber = 'GEM/2026/B/89412';

    // Check if demo bid already exists
    let existingBid = await prisma.bid.findFirst({
      where: { gemBidNumber },
    });

    if (existingBid) {
      // Clean up previous run
      await prisma.complianceResult.deleteMany({ where: { bidId: existingBid.id } });
      await prisma.contradiction.deleteMany({ where: { bidId: existingBid.id } });
      await prisma.requirement.deleteMany({ where: { bidId: existingBid.id } });
      await prisma.evidence.deleteMany({ where: { document: { bidId: existingBid.id } } });
      await prisma.document.deleteMany({ where: { bidId: existingBid.id } });
      await prisma.bid.delete({ where: { id: existingBid.id } });
    }

    const bid = await prisma.bid.create({
      data: {
        title,
        gemBidNumber,
        description: 'Procurement of Enterprise Rack Servers, SAN Storage Arrays, and On-site Warranty for National Informatics Centre (NIC).',
        status: 'ANALYZED',
      },
    });

    // 1. Create Documents
    const docTender = await prisma.document.create({
      data: {
        bidId: bid.id,
        filename: 'GeM_Tender_Specification_89412.pdf',
        originalName: 'GeM_Tender_Specification_89412.pdf',
        docType: 'BID_DOCUMENT',
        filePath: './sample_docs/GeM_Tender_Specification.pdf',
        totalPages: 14,
        processed: true,
        extractionConfidence: 0.98,
      },
    });

    const docDossier = await prisma.document.create({
      data: {
        bidId: bid.id,
        filename: 'Acme_Tech_Bidder_Compliance_Dossier.pdf',
        originalName: 'Acme_Tech_Bidder_Compliance_Dossier.pdf',
        docType: 'FINANCIAL_STATEMENT',
        filePath: './sample_docs/Acme_Tech_Bidder_Compliance_Dossier.pdf',
        totalPages: 28,
        processed: true,
        extractionConfidence: 0.95,
      },
    });

    const docSpec = await prisma.document.create({
      data: {
        bidId: bid.id,
        filename: 'Acme_Tech_Datasheet_Warranty.pdf',
        originalName: 'Acme_Tech_Datasheet_Warranty.pdf',
        docType: 'TECHNICAL_SPEC',
        filePath: './sample_docs/Acme_Tech_Bidder_Compliance_Dossier.pdf',
        totalPages: 6,
        processed: true,
        extractionConfidence: 0.92,
      },
    });

    // 2. Create Requirements
    const reqTurnover = await prisma.requirement.create({
      data: {
        bidId: bid.id,
        code: 'REQ-001',
        category: 'FINANCIAL',
        description: 'Minimum Average Annual Turnover of ₹5.00 Cr in the last 3 financial years (CA Certified).',
        mandatory: true,
        operator: '>=',
        thresholdValue: 5.0,
        unit: 'Cr',
        validationType: 'RULE',
        sourcePage: 2,
        expectedEvidenceType: 'Audited Financial Statements / CA Certificate',
      },
    });

    const reqExp = await prisma.requirement.create({
      data: {
        bidId: bid.id,
        code: 'REQ-002',
        category: 'EXPERIENCE',
        description: 'Minimum 3 years of demonstrated experience executing Central/State Govt ICT supply contracts.',
        mandatory: true,
        operator: '>=',
        thresholdValue: 3.0,
        unit: 'years',
        validationType: 'RULE',
        sourcePage: 2,
        expectedEvidenceType: 'Completion Certificates / Work Orders',
      },
    });

    const reqOEM = await prisma.requirement.create({
      data: {
        bidId: bid.id,
        code: 'REQ-003',
        category: 'BID_SPECIFIC',
        description: 'Manufacturer Authorization Form (MAF) specific to this tender bid number from original server manufacturer.',
        mandatory: true,
        validationType: 'SEMANTIC',
        sourcePage: 3,
        expectedEvidenceType: 'OEM Authorization Letter',
      },
    });

    const reqWarranty = await prisma.requirement.create({
      data: {
        bidId: bid.id,
        code: 'REQ-004',
        category: 'TECHNICAL',
        description: 'Comprehensive 3-year 24x7 on-site OEM warranty with 4-hour response SLA.',
        mandatory: true,
        operator: '>=',
        thresholdValue: 3.0,
        unit: 'years',
        validationType: 'HYBRID',
        sourcePage: 4,
        expectedEvidenceType: 'OEM Warranty Commitment Undertaking',
      },
    });

    const reqISO = await prisma.requirement.create({
      data: {
        bidId: bid.id,
        code: 'REQ-005',
        category: 'CERTIFICATION',
        description: 'Valid ISO 9001:2015 and ISO 27001 certifications as on bid opening date.',
        mandatory: false,
        validationType: 'SEMANTIC',
        sourcePage: 4,
        expectedEvidenceType: 'ISO Accreditation Certificate',
      },
    });

    const reqAffidavit = await prisma.requirement.create({
      data: {
        bidId: bid.id,
        code: 'REQ-006',
        category: 'LEGAL',
        description: 'Notarized Affidavit confirming bidder is not debarred, bankrupt, or blacklisted by any Government agency.',
        mandatory: true,
        validationType: 'SEMANTIC',
        sourcePage: 5,
        expectedEvidenceType: 'Notarized Non-Blacklisting Affidavit',
      },
    });

    // 3. Create Evidence Items
    const evTurnover = await prisma.evidence.create({
      data: {
        documentId: docDossier.id,
        fieldName: 'annual_turnover',
        extractedValue: '₹7.2 Cr',
        pageNumber: 3,
        confidence: 0.96,
        rawText: 'Certified Average Annual Turnover for FY 2023-24, 2022-23, and 2021-22 is ₹7.20 Crores.',
        evidenceType: 'FINANCIAL',
      },
    });

    const evExp = await prisma.evidence.create({
      data: {
        documentId: docDossier.id,
        fieldName: 'years_of_experience',
        extractedValue: '5 years',
        pageNumber: 8,
        confidence: 0.92,
        rawText: 'Acme Technologies has been actively supplying server infrastructure to PSU and Govt entities since 2019 (5+ years).',
        evidenceType: 'EXPERIENCE',
      },
    });

    const evWarrantyDossier = await prisma.evidence.create({
      data: {
        documentId: docDossier.id,
        fieldName: 'warranty_period',
        extractedValue: '3 years',
        pageNumber: 12,
        confidence: 0.94,
        rawText: 'Standard OEM Comprehensive Warranty: 3 Years On-site NBD.',
        evidenceType: 'WARRANTY',
        isContradictory: true,
      },
    });

    const evWarrantySpec = await prisma.evidence.create({
      data: {
        documentId: docSpec.id,
        fieldName: 'warranty_period',
        extractedValue: '1 year',
        pageNumber: 2,
        confidence: 0.91,
        rawText: 'Limited Hardware Warranty valid for 12 months (1 year) from installation date.',
        evidenceType: 'WARRANTY',
        isContradictory: true,
      },
    });

    const evISO = await prisma.evidence.create({
      data: {
        documentId: docDossier.id,
        fieldName: 'iso_certification',
        extractedValue: 'ISO 9001:2015 & ISO 27001 Certified',
        pageNumber: 19,
        confidence: 0.97,
        rawText: 'TUV Rheinland Certificate No. 01 100 14352 - Valid till November 2027.',
        evidenceType: 'CERTIFICATION',
      },
    });

    const evAffidavit = await prisma.evidence.create({
      data: {
        documentId: docDossier.id,
        fieldName: 'non_blacklisting_declaration',
        extractedValue: 'Non-blacklisting Affidavit Verified',
        pageNumber: 24,
        confidence: 0.95,
        rawText: 'Solemnly affirmed that M/s Acme Technologies is not debarred or blacklisted by any Government or PSU department.',
        evidenceType: 'LEGAL',
      },
    });

    // 4. Create Cross-Document Contradiction
    await prisma.contradiction.create({
      data: {
        bidId: bid.id,
        fieldName: 'Warranty Commitment Duration',
        docAId: docDossier.id,
        docAName: docDossier.originalName,
        pageA: 12,
        valueA: '3 years',
        docBId: docSpec.id,
        docBName: docSpec.originalName,
        pageB: 2,
        valueB: '1 year',
        explanation: 'Direct discrepancy between submitted dossier offering 3 years on-site vs equipment specification sheet limiting coverage to 1 year.',
        severity: 'HIGH',
      },
    });

    // 5. Create Compliance Results
    // Result 1: Turnover -> COMPLIANT (Deterministic rule passes)
    await prisma.complianceResult.create({
      data: {
        bidId: bid.id,
        requirementId: reqTurnover.id,
        status: 'COMPLIANT',
        confidence: 0.98,
        reason: 'Extracted turnover ₹7.20 Cr exceeds mandatory requirement of ₹5.00 Cr. Verified via CA Audited Statement.',
        evidenceId: evTurnover.id,
        validationMethod: 'RULE',
        ruleStatus: 'COMPLIANT',
        ruleCalculation: '₹7.2 Cr >= ₹5.0 Cr (72000000 >= 50000000)',
        finalStatus: 'COMPLIANT',
      },
    });

    // Result 2: Experience -> COMPLIANT
    await prisma.complianceResult.create({
      data: {
        bidId: bid.id,
        requirementId: reqExp.id,
        status: 'COMPLIANT',
        confidence: 0.94,
        reason: 'Bidder demonstrates 5 years of verified public sector contract delivery exceeding the 3-year threshold.',
        evidenceId: evExp.id,
        validationMethod: 'RULE',
        ruleStatus: 'COMPLIANT',
        ruleCalculation: '5 years >= 3 years (5 >= 3)',
        finalStatus: 'COMPLIANT',
      },
    });

    // Result 3: OEM Auth -> NEEDS_REVIEW (Mandatory Evidence Missing)
    await prisma.complianceResult.create({
      data: {
        bidId: bid.id,
        requirementId: reqOEM.id,
        status: 'NEEDS_REVIEW',
        confidence: 0.95,
        reason: 'Mandatory evidence missing: No Manufacturer Authorization Form (MAF) was uploaded in submitted documents.',
        evidenceId: null,
        validationMethod: 'SEMANTIC',
        missingEvidence: true,
        isMandatoryIssue: true,
        finalStatus: 'NEEDS_REVIEW',
      },
    });

    // Result 4: Warranty -> NEEDS_REVIEW (Contradiction Detected)
    await prisma.complianceResult.create({
      data: {
        bidId: bid.id,
        requirementId: reqWarranty.id,
        status: 'NEEDS_REVIEW',
        confidence: 0.9,
        reason: 'CONTRADICTION DETECTED: Acme_Tech_Bidder_Compliance_Dossier.pdf (Page 12) specifies 3 years, but Acme_Tech_Datasheet_Warranty.pdf (Page 2) states 1 year.',
        evidenceId: evWarrantyDossier.id,
        validationMethod: 'HYBRID',
        hasContradiction: true,
        isMandatoryIssue: true,
        finalStatus: 'NEEDS_REVIEW',
      },
    });

    // Result 5: ISO Cert -> COMPLIANT
    await prisma.complianceResult.create({
      data: {
        bidId: bid.id,
        requirementId: reqISO.id,
        status: 'COMPLIANT',
        confidence: 0.96,
        reason: 'Valid ISO 9001:2015 and ISO 27001 certificates verified from TUV Rheinland (Valid till Nov 2027).',
        evidenceId: evISO.id,
        validationMethod: 'SEMANTIC',
        finalStatus: 'COMPLIANT',
      },
    });

    // Result 6: Non-Blacklisting Affidavit -> COMPLIANT
    await prisma.complianceResult.create({
      data: {
        bidId: bid.id,
        requirementId: reqAffidavit.id,
        status: 'COMPLIANT',
        confidence: 0.95,
        reason: 'Notarized undertaking affirming non-debarment and financial solvency verified on Page 24.',
        evidenceId: evAffidavit.id,
        validationMethod: 'SEMANTIC',
        finalStatus: 'COMPLIANT',
      },
    });

    // 6. Create Audit Trail
    await logAuditEvent({
      bidId: bid.id,
      action: 'BID_CREATED',
      actor: 'officer@gem.gov.in',
      notes: 'Imported benchmark tender GEM/2026/B/89412.',
    });

    await logAuditEvent({
      bidId: bid.id,
      action: 'ANALYSIS_COMPLETED',
      actor: 'System Engine',
      notes: 'Automated verification flagged 1 missing mandatory MAF document and 1 warranty contradiction.',
    });

    res.status(201).json({
      message: 'SIH Demo bid successfully seeded and ready for live presentation',
      bidId: bid.id,
      title: bid.title,
    });
  } catch (error) {
    console.error('Seed demo error:', error);
    res.status(500).json({ error: 'Failed to seed SIH demo data' });
  }
});

export default router;
