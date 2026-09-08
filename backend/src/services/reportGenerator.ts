import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';
import { computeRiskScore, RiskScore } from './riskScorer';
import { generateExecutiveSummary } from './complianceEngine';

/**
 * Generate a full compliance report PDF for a bid.
 * Returns a readable stream of the PDF document.
 */
export async function generateReport(bidId: string): Promise<PDFKit.PDFDocument> {
  // Fetch all data
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

  // Compute risk score
  const riskItems = bid.results.map((r: { status: string; requirement: { category: string; mandatory: boolean } }) => ({
    status: r.status,
    category: r.requirement.category,
    mandatory: r.requirement.mandatory,
  }));
  const riskScore = computeRiskScore(riskItems);

  // Generate executive summary
  let executiveSummary: string;
  try {
    executiveSummary = await generateExecutiveSummary(bidId);
  } catch {
    executiveSummary = 'Executive summary generation failed. Please refer to the detailed analysis below.';
  }

  // ── Create PDF ─────────────────────────────────────
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 60, left: 50, right: 50 },
    info: {
      Title: `Compliance Report — ${bid.title}`,
      Author: 'GeM Compliance Copilot',
      Subject: 'Bid Compliance Analysis Report',
      Creator: 'GeM Compliance Copilot',
    },
  });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const colors = {
    primary: '#1a1a2e',
    accent: '#6c5ce7',
    teal: '#00cec9',
    success: '#00c853',
    warning: '#ff9100',
    danger: '#ff1744',
    textDark: '#1a1a2e',
    textMuted: '#666680',
    bgLight: '#f4f4f8',
    border: '#dddde8',
  };

  // ── Helper functions ───────────────────────────────
  function addHeader(text: string, size: number = 18) {
    doc
      .font('Helvetica-Bold')
      .fontSize(size)
      .fillColor(colors.primary)
      .text(text, { underline: false });
    doc.moveDown(0.3);
    // Accent underline
    const y = doc.y;
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.margins.left + 80, y)
      .lineWidth(3)
      .strokeColor(colors.accent)
      .stroke();
    doc.moveDown(0.6);
  }

  function addSubheader(text: string) {
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(colors.accent)
      .text(text);
    doc.moveDown(0.3);
  }

  function addBody(text: string) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(colors.textDark)
      .text(text, { lineGap: 3 });
    doc.moveDown(0.3);
  }

  function addMuted(text: string) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(colors.textMuted)
      .text(text, { lineGap: 2 });
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
    doc.moveDown(0.6);
  }

  function statusEmoji(status: string): string {
    switch (status) {
      case 'COMPLIANT': return 'PASS';
      case 'NON_COMPLIANT': return 'FAIL';
      case 'NEEDS_REVIEW': return 'REVIEW';
      default: return status;
    }
  }

  function statusColor(status: string): string {
    switch (status) {
      case 'COMPLIANT': return colors.success;
      case 'NON_COMPLIANT': return colors.danger;
      case 'NEEDS_REVIEW': return colors.warning;
      default: return colors.textMuted;
    }
  }

  function riskLevelColor(level: string): string {
    switch (level) {
      case 'LOW': return colors.success;
      case 'MEDIUM': return colors.warning;
      case 'HIGH': return colors.danger;
      case 'CRITICAL': return colors.danger;
      default: return colors.textMuted;
    }
  }

  function ensureSpace(needed: number) {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  }

  // ── Page 1: Cover ──────────────────────────────────
  doc.moveDown(4);

  // Title block
  doc
    .font('Helvetica-Bold')
    .fontSize(28)
    .fillColor(colors.accent)
    .text('COMPLIANCE REPORT', { align: 'center' });
  doc.moveDown(0.3);
  doc
    .font('Helvetica')
    .fontSize(12)
    .fillColor(colors.textMuted)
    .text('GeM Bid Compliance Copilot — Automated Analysis', { align: 'center' });

  doc.moveDown(2);

  // Horizontal rule
  const ruleY = doc.y;
  doc
    .moveTo(doc.page.margins.left + 100, ruleY)
    .lineTo(doc.page.margins.left + pageWidth - 100, ruleY)
    .lineWidth(2)
    .strokeColor(colors.accent)
    .stroke();

  doc.moveDown(2);

  // Bid info
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(colors.textDark)
    .text(bid.title, { align: 'center' });

  if (bid.gemBidNumber) {
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(colors.textMuted)
      .text(`Bid Number: ${bid.gemBidNumber}`, { align: 'center' });
  }

  doc.moveDown(0.5);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(colors.textMuted)
    .text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'center' });

  doc.moveDown(3);

  // Quick stats box
  const boxY = doc.y;
  const boxHeight = 80;
  doc
    .roundedRect(doc.page.margins.left + 40, boxY, pageWidth - 80, boxHeight, 8)
    .fillColor(colors.bgLight)
    .fill();

  const statWidth = (pageWidth - 80) / 4;
  const stats = [
    { value: String(riskScore.totalRequirements), label: 'Requirements' },
    { value: String(riskScore.compliant), label: 'Compliant' },
    { value: String(riskScore.needsReview), label: 'Needs Review' },
    { value: String(riskScore.nonCompliant), label: 'Non-Compliant' },
  ];

  stats.forEach((stat, i) => {
    const x = doc.page.margins.left + 40 + i * statWidth;
    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor(colors.accent)
      .text(stat.value, x, boxY + 18, { width: statWidth, align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(colors.textMuted)
      .text(stat.label.toUpperCase(), x, boxY + 48, { width: statWidth, align: 'center' });
  });

  doc.y = boxY + boxHeight + 30;

  // Risk level
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(riskLevelColor(riskScore.riskLevel))
    .text(`Risk Level: ${riskScore.riskLevel}`, { align: 'center' });

  if (riskScore.mandatoryFailures > 0) {
    doc.moveDown(0.3);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(colors.danger)
      .text(`⚠ ${riskScore.mandatoryFailures} mandatory requirement(s) failed`, { align: 'center' });
  }

  // ── Page 2: Executive Summary ──────────────────────
  doc.addPage();
  addHeader('1. Executive Summary');
  addBody(executiveSummary);
  addDivider();

  // Recommendation
  addSubheader('Recommendation');
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(riskScore.mandatoryFailures > 0 ? colors.danger : colors.success)
    .text(riskScore.recommendation, { lineGap: 3 });
  doc.moveDown(0.5);
  addDivider();

  // ── Category Breakdown ─────────────────────────────
  addHeader('2. Category Breakdown', 16);

  const categories = [
    { label: 'Financial Compliance', value: riskScore.financialCompliance },
    { label: 'Technical Compliance', value: riskScore.technicalCompliance },
    { label: 'Experience Compliance', value: riskScore.experienceCompliance },
    { label: 'Certification Compliance', value: riskScore.certificationCompliance },
    { label: 'Documentation Compliance', value: riskScore.documentationCompliance },
  ];

  categories.forEach((cat) => {
    const barY = doc.y;
    const barWidth = pageWidth * 0.55;
    const barHeight = 12;
    const barX = doc.page.margins.left + 160;

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(colors.textDark)
      .text(cat.label, doc.page.margins.left, barY + 1, { width: 155 });

    // Background bar
    doc
      .roundedRect(barX, barY, barWidth, barHeight, 4)
      .fillColor('#e8e8f0')
      .fill();

    // Value bar
    const filledWidth = (cat.value / 100) * barWidth;
    const barColor = cat.value >= 80 ? colors.success : cat.value >= 50 ? colors.warning : colors.danger;
    if (filledWidth > 0) {
      doc
        .roundedRect(barX, barY, Math.max(filledWidth, 8), barHeight, 4)
        .fillColor(barColor)
        .fill();
    }

    // Percentage
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(colors.textDark)
      .text(`${cat.value}%`, barX + barWidth + 10, barY + 1);

    doc.y = barY + barHeight + 8;
  });

  addDivider();

  // ── Documents Processed ────────────────────────────
  addHeader('3. Documents Processed', 16);

  bid.documents.forEach((d: { originalName: string; docType: string; totalPages: number | null; processed: boolean }, i: number) => {
    ensureSpace(30);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(colors.textDark)
      .text(`${i + 1}. ${d.originalName}`, {
        continued: true,
      })
      .font('Helvetica')
      .fontSize(8)
      .fillColor(colors.textMuted)
      .text(`  [${d.docType}] — ${d.totalPages || '?'} pages — ${d.processed ? 'Processed' : 'Pending'}`);
  });

  doc.moveDown(0.5);
  addDivider();

  // ── Requirement-by-Requirement Analysis ────────────
  doc.addPage();
  addHeader('4. Compliance Matrix — Detailed Analysis');

  // Separate by status for better readability
  const failures = bid.results.filter((r: any) => r.status === 'NON_COMPLIANT');
  const reviews = bid.results.filter((r: any) => r.status === 'NEEDS_REVIEW');
  const passes = bid.results.filter((r: any) => r.status === 'COMPLIANT');

  function renderResult(result: (typeof failures)[number], index: number) {
    ensureSpace(100);

    // Requirement header row
    const headerY = doc.y;
    const badgeWidth = 55;

    // Status badge background
    doc
      .roundedRect(doc.page.margins.left, headerY, badgeWidth, 16, 3)
      .fillColor(statusColor(result.status))
      .fill();

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#ffffff')
      .text(statusEmoji(result.status), doc.page.margins.left + 4, headerY + 3, { width: badgeWidth - 8, align: 'center' });

    // Code + description
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(colors.textDark)
      .text(
        `${result.requirement.code}: ${result.requirement.description}`,
        doc.page.margins.left + badgeWidth + 10,
        headerY,
        { width: pageWidth - badgeWidth - 10 }
      );

    doc.moveDown(0.3);

    // Meta line
    const metaParts: string[] = [
      `Category: ${result.requirement.category}`,
      result.requirement.mandatory ? 'MANDATORY' : 'Optional',
      `Confidence: ${Math.round(result.confidence * 100)}%`,
    ];

    if (result.requirement.operator) {
      metaParts.push(`Threshold: ${result.requirement.operator} ${result.requirement.thresholdValue} ${result.requirement.unit || ''}`);
    }

    if (result.requirement.sourcePage) {
      metaParts.push(`Source: Page ${result.requirement.sourcePage}`);
    }

    addMuted(metaParts.join(' · '));
    doc.moveDown(0.2);

    // Evidence
    if (result.evidence) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(colors.accent)
        .text('Evidence:', { continued: true })
        .font('Helvetica')
        .fillColor(colors.textDark)
        .text(` ${result.evidence.document?.originalName || 'Document'}`);

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(colors.textDark)
        .text(`Extracted Value: ${result.evidence.extractedValue}`);

      if (result.evidence.pageNumber) {
        addMuted(`Page: ${result.evidence.pageNumber}`);
      }

      if (result.evidence.rawText) {
        doc.moveDown(0.1);
        const snippetY = doc.y;
        doc
          .roundedRect(doc.page.margins.left + 10, snippetY, pageWidth - 20, 24, 3)
          .fillColor(colors.bgLight)
          .fill();
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(colors.textMuted)
          .text(`"${result.evidence.rawText.slice(0, 150)}"`, doc.page.margins.left + 15, snippetY + 5, {
            width: pageWidth - 30,
          });
        doc.y = snippetY + 28;
      }
    } else {
      addMuted('No matching evidence found.');
    }

    doc.moveDown(0.1);

    // Reason
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(colors.textDark)
      .text('Decision: ', { continued: true })
      .font('Helvetica')
      .fillColor(colors.textDark)
      .text(result.reason);

    doc.moveDown(0.5);

    // Separator
    const sepY = doc.y;
    doc
      .moveTo(doc.page.margins.left + 20, sepY)
      .lineTo(doc.page.margins.left + pageWidth - 20, sepY)
      .lineWidth(0.3)
      .strokeColor(colors.border)
      .stroke();
    doc.moveDown(0.5);
  }

  // Non-compliant first (most important)
  if (failures.length > 0) {
    addSubheader(`4.1 Non-Compliant (${failures.length})`);
    failures.forEach(renderResult);
  }

  // Needs review
  if (reviews.length > 0) {
    ensureSpace(40);
    addSubheader(`4.2 Needs Review (${reviews.length})`);
    reviews.forEach(renderResult);
  }

  // Compliant
  if (passes.length > 0) {
    ensureSpace(40);
    addSubheader(`4.3 Compliant (${passes.length})`);
    passes.forEach(renderResult);
  }

  // ── Footer: Audit Trail ────────────────────────────
  doc.addPage();
  addHeader('5. Audit Trail', 16);

  addBody(`Report ID: ${bid.id}`);
  addBody(`Bid Title: ${bid.title}`);
  addBody(`GeM Bid Number: ${bid.gemBidNumber || 'N/A'}`);
  addBody(`Analysis Status: ${bid.status}`);
  addBody(`Analysis Created: ${new Date(bid.createdAt).toLocaleString('en-IN')}`);
  addBody(`Report Generated: ${new Date().toLocaleString('en-IN')}`);
  addBody(`Documents Processed: ${bid.documents.length}`);
  addBody(`Requirements Identified: ${bid.requirements.length}`);
  addBody(`Compliance Results: ${bid.results.length}`);

  addDivider();

  addSubheader('Disclaimer');
  addMuted(
    'This report was generated by the GeM Compliance Copilot using a combination of deterministic rule-based evaluation ' +
    'and AI-powered semantic analysis (Google Gemini). While the system strives for accuracy, all compliance decisions ' +
    'should be verified by a qualified procurement officer. AI-generated assessments carry confidence scores and should ' +
    'not be treated as legally binding determinations. Items marked as "NEEDS_REVIEW" require mandatory human verification.'
  );

  doc.moveDown(1);
  addMuted(
    'This system is designed to assist — not replace — human judgment in government procurement processes.'
  );

  // Finalize
  doc.end();
  return doc;
}
