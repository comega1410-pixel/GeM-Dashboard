import prisma from '../lib/prisma';
import { extractTextFromPDF } from './documentProcessor';
import { extractRequirements } from './requirementExtractor';
import { extractEvidence } from './evidenceExtractor';
import { evaluateWithRules } from './ruleEngine';
import { evaluateWithSemantics } from './semanticEngine';
import { geminiText } from '../lib/gemini';

/**
 * Main compliance engine orchestrator.
 * Runs the full pipeline: document processing → requirement extraction →
 * evidence extraction → rule/semantic evaluation → store results.
 */
export async function runComplianceAnalysis(bidId: string): Promise<void> {
  // Update bid status
  await prisma.bid.update({
    where: { id: bidId },
    data: { status: 'PROCESSING' },
  });

  try {
    // 1. Get all documents for this bid
    const documents = await prisma.document.findMany({
      where: { bidId },
    });

    if (documents.length === 0) {
      throw new Error('No documents uploaded for this bid');
    }

    // 2. Process all documents — extract text
    console.log(`Processing ${documents.length} documents...`);
    for (const doc of documents) {
      if (!doc.processed) {
        const parsed = await extractTextFromPDF(doc.filePath);
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            processedText: parsed.fullText,
            totalPages: parsed.totalPages,
            ocrRequired: parsed.ocrUsed,
            processed: true,
          },
        });
      }
    }

    // 3. Find the bid document (the tender)
    const bidDocument = documents.find((d: any) => d.docType === 'BID_DOCUMENT');
    if (!bidDocument) {
      throw new Error('No bid document found. Please upload the tender document with type BID_DOCUMENT.');
    }

    // Reload to get processed text
    const processedBidDoc = await prisma.document.findUnique({
      where: { id: bidDocument.id },
    });

    if (!processedBidDoc?.processedText) {
      throw new Error('Failed to extract text from bid document');
    }

    // 4. Extract requirements from the bid document
    console.log('Extracting requirements...');
    const extractedRequirements = await extractRequirements(processedBidDoc.processedText);
    console.log(`Found ${extractedRequirements.length} requirements`);

    // Store requirements in DB
    // Clear existing requirements for this bid first
    await prisma.complianceResult.deleteMany({ where: { bidId } });
    await prisma.requirement.deleteMany({ where: { bidId } });
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
            sourcePage: req.sourcePage ?? null,
          },
        })
      )
    );

    // 5. Extract evidence from bidder documents
    console.log('Extracting evidence from bidder documents...');
    const bidderDocs = documents.filter((d: any) => d.docType !== 'BID_DOCUMENT');
    const processedBidderDocs = await prisma.document.findMany({
      where: {
        bidId,
        docType: { not: 'BID_DOCUMENT' },
        processed: true,
      },
    });

    const allEvidence: Array<{
      id: string;
      fieldName: string;
      extractedValue: string;
      pageNumber: number | null;
      confidence: number | null;
      rawText: string | null;
      document: { originalName: string; docType: string };
    }> = [];

    for (const doc of processedBidderDocs) {
      if (!doc.processedText) continue;

      const evidenceItems = await extractEvidence(
        doc.processedText,
        doc.originalName,
        doc.docType
      );

      for (const ev of evidenceItems) {
        const saved = await prisma.evidence.create({
          data: {
            documentId: doc.id,
            fieldName: ev.fieldName,
            extractedValue: ev.extractedValue,
            pageNumber: ev.pageNumber ?? null,
            confidence: ev.confidence ?? null,
            rawText: ev.rawText || null,
          },
        });

        allEvidence.push({
          id: saved.id,
          fieldName: saved.fieldName,
          extractedValue: saved.extractedValue,
          pageNumber: saved.pageNumber,
          confidence: saved.confidence,
          rawText: saved.rawText,
          document: {
            originalName: doc.originalName,
            docType: doc.docType,
          },
        });
      }
    }

    console.log(`Extracted ${allEvidence.length} evidence items`);

    // 6. Evaluate each requirement
    console.log('Evaluating compliance...');
    for (const req of savedRequirements) {
      const extractedReq = extractedRequirements.find((r) => r.code === req.code);
      if (!extractedReq) continue;

      // Try rule engine first (for quantifiable requirements)
      const ruleResult = evaluateWithRules(extractedReq, allEvidence);

      let finalStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
      let finalConfidence: number;
      let finalReason: string;
      let finalEvidenceId: string | null = null;

      if (ruleResult && ruleResult.status !== 'NEEDS_REVIEW') {
        // Rule engine gave a definitive answer
        finalStatus = ruleResult.status;
        finalConfidence = ruleResult.confidence;
        finalReason = ruleResult.reason;
        finalEvidenceId = ruleResult.matchedEvidenceId || null;
      } else {
        // Fall back to semantic engine
        const semanticResult = await evaluateWithSemantics(
          req.description,
          req.category,
          allEvidence
        );

        finalStatus = semanticResult.status;
        finalConfidence = semanticResult.confidence;
        finalReason = semanticResult.reason;
        finalEvidenceId = semanticResult.matchedEvidenceId || null;
      }

      await prisma.complianceResult.create({
        data: {
          bidId,
          requirementId: req.id,
          status: finalStatus,
          confidence: finalConfidence,
          reason: finalReason,
          evidenceId: finalEvidenceId,
        },
      });
    }

    // 7. Update bid status
    await prisma.bid.update({
      where: { id: bidId },
      data: { status: 'ANALYZED' },
    });

    console.log('Compliance analysis complete!');
  } catch (error) {
    console.error('Compliance analysis failed:', error);
    await prisma.bid.update({
      where: { id: bidId },
      data: { status: 'ERROR' },
    });
    throw error;
  }
}

/**
 * Generate an AI executive summary for a completed analysis.
 */
export async function generateExecutiveSummary(bidId: string): Promise<string> {
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    include: {
      requirements: true,
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

  const compliant = bid.results.filter((r: any) => r.status === 'COMPLIANT');
  const nonCompliant = bid.results.filter((r: any) => r.status === 'NON_COMPLIANT');
  const needsReview = bid.results.filter((r: any) => r.status === 'NEEDS_REVIEW');

  const failureDetails = nonCompliant
    .map((r: any) => `- ${r.requirement.description}: ${r.reason}`)
    .join('\n');

  const reviewDetails = needsReview
    .map((r: any) => `- ${r.requirement.description}: ${r.reason}`)
    .join('\n');

  const prompt = `Write a concise executive summary for a government procurement compliance analysis.

Bid: "${bid.title}" (${bid.gemBidNumber || 'N/A'})
Total requirements: ${bid.requirements.length}
Compliant: ${compliant.length}
Non-compliant: ${nonCompliant.length}
Needs review: ${needsReview.length}

Failures:
${failureDetails || 'None'}

Items needing review:
${reviewDetails || 'None'}

Write 3-5 sentences summarizing the analysis results. Be factual, professional, and highlight critical issues. Do not use markdown formatting.`;

  return geminiText(prompt);
}
