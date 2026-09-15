import prisma from '../lib/prisma';
import { extractTextFromPDF } from './documentProcessor';
import { extractRequirements } from './requirementExtractor';
import { extractEvidence } from './evidenceExtractor';
import { evaluateWithRules } from './ruleEngine';
import { evaluateWithSemantics } from './semanticEngine';
import { evaluateEvidenceSufficiency } from './missingEvidenceDetector';
import { detectContradictions } from './contradictionEngine';
import { logAuditEvent } from './auditLogger';
import { geminiText } from '../lib/gemini';
import { EvidenceItem, ExtractedRequirement, ComplianceStatus, ValidationMethod } from '../types';

/**
 * Main compliance engine orchestrator.
 * Full pipeline: document processing → requirement extraction →
 * evidence extraction → contradiction detection → missing evidence detection →
 * deterministic rules & semantic verification → audit trail.
 */
export async function runComplianceAnalysis(bidId: string, actorEmail: string = 'system'): Promise<void> {
  // Update bid status
  await prisma.bid.update({
    where: { id: bidId },
    data: { status: 'PROCESSING' },
  });

  await logAuditEvent({
    bidId,
    action: 'ANALYSIS_STARTED',
    actor: actorEmail,
    notes: 'Initiated end-to-end compliance verification pipeline.',
  });

  try {
    // 1. Get all documents for this bid
    const documents = await prisma.document.findMany({
      where: { bidId },
    });

    if (documents.length === 0) {
      throw new Error('No documents uploaded for this bid');
    }

    // 2. Process all documents — extract text and detect document type
    console.log(`Processing ${documents.length} documents...`);
    for (const doc of documents) {
      if (!doc.processed) {
        const parsed = await extractTextFromPDF(doc.filePath, doc.originalName);
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            processedText: parsed.fullText,
            totalPages: parsed.totalPages,
            ocrRequired: parsed.ocrUsed,
            processed: true,
            extractionConfidence: parsed.extractionConfidence,
            docType: doc.userCorrected ? doc.docType : parsed.detectedType,
            processingErrors: parsed.processingErrors || null,
          },
        });
      }
    }

    // 3. Find the tender/bid document
    const allDocs = await prisma.document.findMany({ where: { bidId } });
    let bidDocument = allDocs.find((d) => d.docType === 'BID_DOCUMENT');

    // Fallback: if not classified as BID_DOCUMENT, pick the first document or one with tender in name
    if (!bidDocument) {
      bidDocument = allDocs.find((d) => /tender|bid/i.test(d.originalName)) || allDocs[0];
      if (bidDocument) {
        await prisma.document.update({
          where: { id: bidDocument.id },
          data: { docType: 'BID_DOCUMENT' },
        });
      }
    }

    if (!bidDocument || !bidDocument.processedText) {
      throw new Error('Failed to identify valid bid specification document with extracted text.');
    }

    // 4. Extract requirements from the bid document
    console.log('Extracting requirements with taxonomy...');
    const extractedRequirements = await extractRequirements(bidDocument.processedText);
    console.log(`Found ${extractedRequirements.length} requirements`);

    // Clear existing results, requirements, evidence, and contradictions for fresh analysis
    await prisma.complianceResult.deleteMany({ where: { bidId } });
    await prisma.requirement.deleteMany({ where: { bidId } });
    await prisma.contradiction.deleteMany({ where: { bidId } });
    await prisma.evidence.deleteMany({
      where: { document: { bidId } },
    });

    const savedRequirements = await Promise.all(
      extractedRequirements.map((req) =>
        prisma.requirement.create({
          data: {
            bidId,
            code: req.code,
            category: req.category,
            description: req.description,
            mandatory: req.mandatory,
            operator: req.operator || null,
            thresholdValue: req.thresholdValue ?? null,
            unit: req.unit || null,
            expectedEvidenceType: req.expectedEvidenceType || null,
            validationType: req.validationType || 'HYBRID',
            sourcePage: req.sourcePage ?? null,
            sourceRequirementText: req.sourceRequirementText || req.description,
          },
        })
      )
    );

    // 5. Extract evidence from bidder documents
    console.log('Extracting evidence from bidder documents...');
    const bidderDocs = allDocs.filter((d) => d.id !== bidDocument!.id);

    const allEvidence: EvidenceItem[] = [];

    for (const doc of bidderDocs) {
      if (!doc.processedText) continue;

      const evidenceItems = await extractEvidence(doc.processedText, doc.originalName, doc.docType);

      for (const ev of evidenceItems) {
        const saved = await prisma.evidence.create({
          data: {
            documentId: doc.id,
            fieldName: ev.fieldName,
            extractedValue: ev.extractedValue,
            pageNumber: ev.pageNumber ?? null,
            confidence: ev.confidence ?? null,
            rawText: ev.rawText || null,
            evidenceType: ev.evidenceType || null,
          },
        });

        allEvidence.push({
          id: saved.id,
          fieldName: saved.fieldName,
          extractedValue: saved.extractedValue,
          pageNumber: saved.pageNumber,
          confidence: saved.confidence,
          rawText: saved.rawText,
          evidenceType: saved.evidenceType,
          document: {
            id: doc.id,
            originalName: doc.originalName,
            docType: doc.docType,
          },
        });
      }
    }

    console.log(`Extracted ${allEvidence.length} evidence items`);

    // 6. Cross-document contradiction detection
    console.log('Running contradiction engine...');
    const detectedContradictions = detectContradictions(allEvidence);
    console.log(`Detected ${detectedContradictions.length} contradictions across documents`);

    for (const c of detectedContradictions) {
      await prisma.contradiction.create({
        data: {
          bidId,
          fieldName: c.fieldName,
          docAId: c.docAId,
          docAName: c.docAName,
          pageA: c.pageA ?? null,
          valueA: c.valueA,
          docBId: c.docBId,
          docBName: c.docBName,
          pageB: c.pageB ?? null,
          valueB: c.valueB,
          explanation: c.explanation,
          severity: c.severity,
        },
      });

      // Mark evidence items as contradictory
      await prisma.evidence.updateMany({
        where: {
          document: { bidId },
          extractedValue: { in: [c.valueA, c.valueB] },
        },
        data: { isContradictory: true },
      });
    }

    // 7. Evaluate each requirement with full evidence traceability
    console.log('Evaluating requirement-level compliance...');
    for (const req of savedRequirements) {
      const extractedReq = extractedRequirements.find((r) => r.code === req.code);
      if (!extractedReq) continue;

      // Check missing evidence first
      const sufficiencyCheck = evaluateEvidenceSufficiency(extractedReq, allEvidence);

      // Check contradiction presence for this requirement
      const reqContradiction = detectedContradictions.find(
        (c) =>
          c.fieldName.toLowerCase().includes(req.category.toLowerCase()) ||
          req.description.toLowerCase().includes(c.fieldName.toLowerCase())
      );

      let finalStatus: ComplianceStatus = 'NEEDS_REVIEW';
      let finalConfidence = 0.85;
      let finalReason = '';
      let finalEvidenceId: string | null = sufficiencyCheck.matchedEvidence?.id || null;

      let ruleStatus: ComplianceStatus | null = null;
      let ruleCalculation: string | null = null;
      let aiStatus: ComplianceStatus | null = null;
      let aiConfidence: number | null = null;
      let aiReasoning: string | null = null;
      let validationMethod: ValidationMethod = (req.validationType as ValidationMethod) || 'HYBRID';

      // Rule Engine (Deterministic)
      const ruleResult = evaluateWithRules(extractedReq, allEvidence);
      if (ruleResult) {
        ruleStatus = ruleResult.status;
        ruleCalculation = ruleResult.calculation || null;
      }

      // Check if evidence is missing
      if (sufficiencyCheck.isMissing) {
        finalStatus = 'NEEDS_REVIEW';
        finalReason = sufficiencyCheck.reason || 'Evidence missing.';
        validationMethod = 'RULE';
      } else if (reqContradiction) {
        // Critical contradiction blocks compliance
        finalStatus = 'NEEDS_REVIEW';
        finalReason = `CONTRADICTION DETECTED: Discrepancy between ${reqContradiction.docAName} ("${reqContradiction.valueA}") and ${reqContradiction.docBName} ("${reqContradiction.valueB}"). Manual officer review mandatory.`;
        validationMethod = 'HYBRID';
      } else if (ruleResult && ruleResult.status !== 'NEEDS_REVIEW') {
        // Deterministic rule gave decisive result (COMPLIANT or NON_COMPLIANT)
        finalStatus = ruleResult.status;
        finalConfidence = ruleResult.confidence;
        finalReason = ruleResult.reason;
        finalEvidenceId = ruleResult.matchedEvidenceId || finalEvidenceId;
        validationMethod = 'RULE';
      } else {
        // Semantic AI engine for subjective checks
        validationMethod = 'SEMANTIC';
        const semanticResult = await evaluateWithSemantics(req.description, req.category, allEvidence);

        aiStatus = semanticResult.status;
        aiConfidence = semanticResult.confidence;
        aiReasoning = semanticResult.reason;

        finalStatus = semanticResult.status;
        finalConfidence = semanticResult.confidence;
        finalReason = semanticResult.reason;
        finalEvidenceId = semanticResult.matchedEvidenceId || finalEvidenceId;
      }

      // Flag mandatory issue if mandatory requirement is not compliant or has issues
      const isMandatoryIssue = req.mandatory && (finalStatus === 'NON_COMPLIANT' || sufficiencyCheck.isMissing || !!reqContradiction);

      await prisma.complianceResult.create({
        data: {
          bidId,
          requirementId: req.id,
          status: finalStatus,
          confidence: finalConfidence,
          reason: finalReason,
          evidenceId: finalEvidenceId,
          validationMethod,
          ruleStatus,
          ruleCalculation,
          aiStatus,
          aiConfidence,
          aiReasoning,
          missingEvidence: sufficiencyCheck.isMissing,
          hasContradiction: !!reqContradiction,
          isMandatoryIssue,
          finalStatus, // Initial final status reflects AI/Rule recommendation until reviewer override
        },
      });
    }

    // 8. Update bid status
    await prisma.bid.update({
      where: { id: bidId },
      data: { status: 'ANALYZED' },
    });

    await logAuditEvent({
      bidId,
      action: 'ANALYSIS_COMPLETED',
      actor: actorEmail,
      notes: `Successfully analyzed ${savedRequirements.length} requirements with ${detectedContradictions.length} contradictions flagged.`,
    });

    console.log('Compliance analysis completed successfully!');
  } catch (error) {
    console.error('Compliance analysis failed:', error);
    await prisma.bid.update({
      where: { id: bidId },
      data: { status: 'ERROR' },
    });

    await logAuditEvent({
      bidId,
      action: 'ANALYSIS_ERROR',
      actor: actorEmail,
      notes: `Analysis error: ${(error as Error).message}`,
    });

    throw error;
  }
}

/**
 * Generate an explainable, audit-grade executive summary.
 */
export async function generateExecutiveSummary(bidId: string): Promise<string> {
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    include: {
      requirements: true,
      contradictions: true,
      results: {
        include: {
          requirement: true,
          evidence: { include: { document: true } },
        },
      },
    },
  });

  if (!bid || bid.status !== 'ANALYZED') {
    throw new Error('Bid analysis not complete');
  }

  const compliant = bid.results.filter((r) => r.finalStatus === 'COMPLIANT');
  const nonCompliant = bid.results.filter((r) => r.finalStatus === 'NON_COMPLIANT');
  const needsReview = bid.results.filter((r) => r.finalStatus === 'NEEDS_REVIEW');
  const mandatoryFailures = bid.results.filter((r) => r.isMandatoryIssue);

  const failureDetails = nonCompliant
    .map((r) => `- [${r.requirement.code}] ${r.requirement.description}: ${r.reason}`)
    .join('\n');

  const reviewDetails = needsReview
    .map((r) => `- [${r.requirement.code}] ${r.requirement.description}: ${r.reason}`)
    .join('\n');

  const contradictionDetails = bid.contradictions
    .map((c) => `- ${c.fieldName}: ${c.docAName} vs ${c.docBName}`)
    .join('\n');

  const prompt = `You are a senior government procurement officer summarizing an automated compliance audit for GeM (Government e-Marketplace).

Bid: "${bid.title}" (${bid.gemBidNumber || 'N/A'})
Total Requirements: ${bid.requirements.length}
Compliant: ${compliant.length}
Non-Compliant: ${nonCompliant.length}
Needs Review: ${needsReview.length}
Mandatory Issues: ${mandatoryFailures.length}
Contradictions: ${bid.contradictions.length}

Critical Failures:
${failureDetails || 'None'}

Items Requiring Officer Review:
${reviewDetails || 'None'}

Cross-Document Contradictions:
${contradictionDetails || 'None'}

Write an official 3-4 sentence procurement executive summary. State whether mandatory failures or contradictions block auto-qualification, and note specific items the officer must inspect. Do not use markdown headers.`;

  return geminiText(prompt);
}
