import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';
import { computeRiskScore } from './riskScorer';
import { generateExecutiveSummary } from './complianceEngine';

/**
 * Generate a full audit-grade compliance report PDF for a bid.
 * Returns a readable stream of the PDF document.
 */
export async function generateReport(bidId: string): Promise<PDFKit.PDFDocument> {
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    include: {
      documents: {
        select: {
          id: true,
          originalName: true,
          docType: true,
          totalPages: true,
          processed: true,
        },
      },
      requirements: { orderBy: { code: 'asc' } },
      contradictions: { orderBy: { createdAt: 'desc' } },
      auditLogs: { orderBy: { timestamp: 'desc' }, take: 10 },
      results: {
        include: {
          requirement: true,
          evidence: {
            include: {
              document: {
                select: { originalName: true, docType: true },
              },
            },
          },
        },
        orderBy: { requirement: { code: 'asc' } },
      },
    },
  });

  if (!bid) throw new Error('Bid not found');
  if (bid.status !== 'ANALYZED') throw new Error('Analysis not yet complete');

  // Compute explainable risk score
  const riskItems = bid.results.map((r: any) => ({
    status: r.finalStatus || r.status,
    category: r.requirement.category,
    mandatory: r.requirement.mandatory,
    code: r.requirement.code,
    description: r.requirement.description,
    missingEvidence: r.missingEvidence,
    hasContradiction: r.hasContradiction,
    ruleStatus: r.ruleStatus,
  }));

  const contradictionItems = bid.contradictions.map((c: any) => ({
    fieldName: c.fieldName,
    docAName: c.docAName,
    docBName: c.docBName,
    severity: c.severity,
  }));

  const riskScore = computeRiskScore(riskItems, contradictionItems);

  // Generate executive summary
  let executiveSummary: string;
  try {
    executiveSummary = await generateExecutiveSummary(bidId);
  } catch {
    executiveSummary = 'Executive summary generation completed with rule-based metrics. Refer to detailed breakdown below.';
  }

  // ── Create PDF ─────────────────────────────────────
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 45, right: 45 },
    info: {
      Title: `GeM Compliance Audit Report — ${bid.title}`,
      Author: 'GeM Compliance Copilot',
      Subject: 'Official Bid Compliance Audit Report',
      Creator: 'GeM Compliance Copilot (SIH Upgrade)',
    },
  });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const colors = {
    primary: '#0f172a',
    accent: '#4f46e5',
    teal: '#0d9488',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    textDark: '#1e293b',
    textMuted: '#64748b',
    bgLight: '#f8fafc',
    border: '#cbd5e1',
  };

  // Helper functions
  function addHeader(text: string, size: number = 18) {
    doc.font('Helvetica-Bold').fontSize(size).fillColor(colors.primary).text(text);
    doc.moveDown(0.3);
    const y = doc.y;
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.margins.left + 70, y)
      .lineWidth(2.5)
      .strokeColor(colors.accent)
      .stroke();
    doc.moveDown(0.6);
  }

  function addSubheader(text: string) {
    ensureSpace(35);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text(text);
    doc.moveDown(0.4);
  }

  function addBody(text: string) {
    doc.font('Helvetica').fontSize(9).fillColor(colors.textDark).text(text);
    doc.moveDown(0.3);
  }

  function addMuted(text: string) {
    doc.font('Helvetica').fontSize(8).fillColor(colors.textMuted).text(text);
    doc.moveDown(0.2);
  }

  function addDivider() {
    doc.moveDown(0.4);
    const y = doc.y;
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.margins.left + pageWidth, y)
      .lineWidth(0.5)
      .strokeColor(colors.border)
      .stroke();
    doc.moveDown(0.5);
  }

  function ensureSpace(needed: number) {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  }

  // ── Cover Banner ───────────────────────────────────
  const startY = doc.y;
  doc
    .roundedRect(doc.page.margins.left, startY, pageWidth, 68, 6)
    .fillColor(colors.primary)
    .fill();

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#ffffff')
    .text('GOVERNMENT e-MARKETPLACE (GeM) COMPLIANCE AUDIT REPORT', doc.page.margins.left + 15, startY + 12);

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#94a3b8')
    .text(`Bid: "${bid.title}" | GeM Bid No: ${bid.gemBidNumber || 'N/A'} | Generated: ${new Date().toLocaleDateString('en-IN')}`, doc.page.margins.left + 15, startY + 38);

  doc.y = startY + 80;

  // Qualification Status Banner
  const isBlocked = riskScore.mandatoryFailures > 0 || riskScore.contradictionCount > 0;
  const bannerColor = isBlocked ? colors.danger : colors.success;
  const bannerBg = isBlocked ? '#fee2e2' : '#dcfce7';

  const bannerY = doc.y;
  doc
    .roundedRect(doc.page.margins.left, bannerY, pageWidth, 32, 4)
    .fillColor(bannerBg)
    .fill();

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(bannerColor)
    .text(
      isBlocked
        ? '⚠️ MANDATORY ISSUE DETECTED — AUTOMATED QUALIFICATION BLOCKED (HUMAN REVIEW REQUIRED)'
        : '✓ ALL MANDATORY REQUIREMENTS SATISFIED — PENDING OFFICER FINAL SIGN-OFF',
      doc.page.margins.left + 12,
      bannerY + 10
    );

  doc.y = bannerY + 42;

  // ── 1. Executive Summary ───────────────────────────
  addHeader('1. Executive Summary', 14);
  addBody(executiveSummary);

  addDivider();

  // ── 2. Explainable Risk Breakdown ───────────────────
  addHeader('2. Explainable Risk Scoring Breakdown', 14);

  // Cards row
  const cardWidth = (pageWidth - 20) / 3;
  const cardY = doc.y;

  // Score Card
  doc.roundedRect(doc.page.margins.left, cardY, cardWidth, 50, 4).fillColor(colors.bgLight).fill();
  doc.font('Helvetica-Bold').fontSize(16).fillColor(isBlocked ? colors.danger : colors.success).text(`${riskScore.overallScore}/100`, doc.page.margins.left + 10, cardY + 10);
  doc.font('Helvetica').fontSize(8).fillColor(colors.textMuted).text('Overall Risk Score (0 = Min, 100 = Max)', doc.page.margins.left + 10, cardY + 32);

  // Mandatory Card
  doc.roundedRect(doc.page.margins.left + cardWidth + 10, cardY, cardWidth, 50, 4).fillColor(colors.bgLight).fill();
  doc.font('Helvetica-Bold').fontSize(16).fillColor(riskScore.mandatoryFailures > 0 ? colors.danger : colors.success).text(`${riskScore.mandatoryFailures}`, doc.page.margins.left + cardWidth + 20, cardY + 10);
  doc.font('Helvetica').fontSize(8).fillColor(colors.textMuted).text('Mandatory Failures', doc.page.margins.left + cardWidth + 20, cardY + 32);

  // Contradictions Card
  doc.roundedRect(doc.page.margins.left + (cardWidth + 10) * 2, cardY, cardWidth, 50, 4).fillColor(colors.bgLight).fill();
  doc.font('Helvetica-Bold').fontSize(16).fillColor(riskScore.contradictionCount > 0 ? colors.warning : colors.success).text(`${riskScore.contradictionCount}`, doc.page.margins.left + (cardWidth + 10) * 2 + 10, cardY + 10);
  doc.font('Helvetica').fontSize(8).fillColor(colors.textMuted).text('Contradictions Detected', doc.page.margins.left + (cardWidth + 10) * 2 + 10, cardY + 32);

  doc.y = cardY + 60;

  // Category Risk Table
  doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.primary).text('Category Risk Penalties (out of 20 max each):');
  doc.moveDown(0.2);

  const cats = [
    { name: 'Financial', score: riskScore.categoryBreakdown.financial.score },
    { name: 'Technical', score: riskScore.categoryBreakdown.technical.score },
    { name: 'Experience', score: riskScore.categoryBreakdown.experience.score },
    { name: 'Certification', score: riskScore.categoryBreakdown.certification.score },
    { name: 'Documentation', score: riskScore.categoryBreakdown.documentation.score },
  ];

  doc.font('Helvetica').fontSize(8).fillColor(colors.textDark).text(cats.map((c) => `${c.name}: ${c.score}/20`).join('   |   '));
  doc.moveDown(0.5);

  // Top Risk Drivers
  if (riskScore.topRiskDrivers.length > 0) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.danger).text('Top Identified Risk Drivers:');
    doc.moveDown(0.2);
    riskScore.topRiskDrivers.forEach((driver, idx) => {
      doc.font('Helvetica').fontSize(8).fillColor(colors.textDark).text(`${idx + 1}. ${driver}`);
    });
  }

  addDivider();

  // ── 3. Contradictions Section (if any) ──────────────
  if (bid.contradictions.length > 0) {
    ensureSpace(80);
    addHeader('3. Cross-Document Contradiction Analysis', 14);

    bid.contradictions.forEach((c: any, i: number) => {
      ensureSpace(45);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.danger).text(`[${i + 1}] Conflict in ${c.fieldName}:`);
      doc.font('Helvetica').fontSize(8).fillColor(colors.textDark).text(`• Document A: ${c.docAName} ${c.pageA ? `(Page ${c.pageA})` : ''} → Value: "${c.valueA}"`);
      doc.font('Helvetica').fontSize(8).fillColor(colors.textDark).text(`• Document B: ${c.docBName} ${c.pageB ? `(Page ${c.pageB})` : ''} → Value: "${c.valueB}"`);
      doc.font('Helvetica').fontSize(8).fillColor(colors.textMuted).text(`Analysis: ${c.explanation}`);
      doc.moveDown(0.4);
    });

    addDivider();
  }

  // ── 4. Requirement-by-Requirement Evidence Graph ────
  doc.addPage();
  addHeader('4. Complete Requirement Compliance Matrix & Evidence Graph', 14);

  for (const r of bid.results) {
    ensureSpace(85);

    const isNonComp = r.finalStatus === 'NON_COMPLIANT';
    const isReview = r.finalStatus === 'NEEDS_REVIEW';
    const statusColor = isNonComp ? colors.danger : isReview ? colors.warning : colors.success;

    // Requirement Code and Status
    doc.font('Helvetica-Bold').fontSize(10).fillColor(statusColor).text(`[${r.finalStatus}] `, { continued: true });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.primary).text(`${r.requirement.code}: ${r.requirement.description}`);
    doc.moveDown(0.2);

    // Metadata line
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(colors.textMuted)
      .text(
        `Category: ${r.requirement.category}  |  ${r.requirement.mandatory ? 'MANDATORY' : 'OPTIONAL'}  |  Validation: ${r.validationMethod}  |  Confidence: ${Math.round(
          r.confidence * 100
        )}%`
      );

    // Calculation if numeric
    if (r.ruleCalculation) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.accent).text(`Rule Calculation: `, { continued: true });
      doc.font('Helvetica').fontSize(8).fillColor(colors.textDark).text(r.ruleCalculation);
    }

    // Evidence citation
    if (r.evidence) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.textDark).text(`Evidence Source: `, { continued: true });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(colors.textDark)
        .text(`${r.evidence.document?.originalName || 'Document'}${r.evidence.pageNumber ? ` (Page ${r.evidence.pageNumber})` : ''} → "${r.evidence.extractedValue}"`);
    } else {
      doc.font('Helvetica').fontSize(8).fillColor(colors.danger).text('Evidence: No supporting evidence found in submitted documents.');
    }

    // AI Recommendation vs Human Decision
    doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.textDark).text(`AI Recommendation: `, { continued: true });
    doc.font('Helvetica').fontSize(8).fillColor(colors.textMuted).text(`${r.status} (${r.reason})`);

    if (r.reviewedBy) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.accent).text(`Final Human Decision: `, { continued: true });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(statusColor)
        .text(`${r.finalStatus} by ${r.reviewedBy}${r.reviewerReason ? ` — Note: ${r.reviewerReason}` : ''}`);
    }

    doc.moveDown(0.5);
    const lineY = doc.y;
    doc.moveTo(doc.page.margins.left, lineY).lineTo(doc.page.margins.left + pageWidth, lineY).lineWidth(0.3).strokeColor(colors.border).stroke();
    doc.moveDown(0.5);
  }

  // ── 5. Audit Trail & Legal Seal ────────────────────
  ensureSpace(120);
  addHeader('5. Official Audit Trail & Digital Authentication', 14);

  addBody(`Report Unique Identifier: ${bid.id}`);
  addBody(`Generated Timestamp: ${new Date().toISOString()}`);
  addBody(`Platform: GeM Compliance Copilot v2.0 (SIH Special Edition)`);

  if (bid.auditLogs && bid.auditLogs.length > 0) {
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.primary).text('Recent Verified Audit Actions:');
    bid.auditLogs.forEach((log: any) => {
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(colors.textMuted)
        .text(`• [${new Date(log.timestamp).toLocaleTimeString('en-IN')}] ${log.action} by ${log.actor}: ${log.notes || 'N/A'}`);
    });
  }

  addDivider();

  addSubheader('Legal Notice & Officer Certification');
  addMuted(
    'This compliance audit document provides AI-assisted, evidence-grounded verification for public procurement under GeM Guidelines. ' +
    'Automated rule calculations and semantic extractions are cited with page-level traceability to prevent hallucinations. ' +
    'Under GeM General Financial Rules (GFR 2017), final contract awards remain the sole responsibility of the designated Procurement Officer.'
  );

  doc.end();
  return doc;
}
