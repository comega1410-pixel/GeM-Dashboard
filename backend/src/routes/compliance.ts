import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { runComplianceAnalysis, generateExecutiveSummary } from '../services/complianceEngine';
import { computeRiskScore } from '../services/riskScorer';

const router = Router();

// Trigger compliance analysis for a bid
router.post('/:bidId/analyze', async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;
    const actorEmail = (req.headers['x-user-email'] as string) || 'officer@gem.gov.in';

    const bid = await prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    if (bid.status === 'PROCESSING') {
      return res.status(409).json({ error: 'Analysis already in progress' });
    }

    res.json({ message: 'Analysis started', bidId, status: 'PROCESSING' });

    // Run asynchronously
    runComplianceAnalysis(bidId, actorEmail).catch((error) => {
      console.error(`Analysis failed for bid ${bidId}:`, error);
    });
  } catch (error) {
    console.error('Start analysis error:', error);
    res.status(500).json({ error: 'Failed to start analysis' });
  }
});

// Get compliance matrix and explainable risk breakdown for a bid
router.get('/:bidId/compliance', async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;

    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      select: { id: true, title: true, status: true, gemBidNumber: true, description: true, createdAt: true },
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const results = await prisma.complianceResult.findMany({
      where: { bidId },
      include: {
        requirement: true,
        evidence: {
          include: {
            document: {
              select: {
                id: true,
                originalName: true,
                docType: true,
              },
            },
          },
        },
      },
      orderBy: {
        requirement: { code: 'asc' },
      },
    });

    const contradictions = await prisma.contradiction.findMany({
      where: { bidId },
      orderBy: { createdAt: 'desc' },
    });

    // Compute explainable deterministic risk score
    const riskItems = results.map((r) => ({
      status: r.finalStatus || r.status,
      category: r.requirement.category,
      mandatory: r.requirement.mandatory,
      code: r.requirement.code,
      description: r.requirement.description,
      missingEvidence: r.missingEvidence,
      hasContradiction: r.hasContradiction,
      ruleStatus: r.ruleStatus,
    }));

    const contradictionItems = contradictions.map((c) => ({
      fieldName: c.fieldName,
      docAName: c.docAName,
      docBName: c.docBName,
      severity: c.severity,
    }));

    const riskScore = computeRiskScore(riskItems, contradictionItems);

    res.json({
      bid,
      results,
      contradictions,
      riskScore,
    });
  } catch (error) {
    console.error('Get compliance error:', error);
    res.status(500).json({ error: 'Failed to get compliance results' });
  }
});

// Get detailed result for a single requirement
router.get('/:bidId/compliance/:reqId', async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;
    const reqId = req.params.reqId as string;

    const result = await prisma.complianceResult.findFirst({
      where: {
        bidId,
        requirementId: reqId,
      },
      include: {
        requirement: true,
        evidence: {
          include: {
            document: true,
          },
        },
      },
    });

    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    // Get all evidence for this bid
    const allEvidence = await prisma.evidence.findMany({
      where: {
        document: { bidId },
      },
      include: {
        document: {
          select: {
            id: true,
            originalName: true,
            docType: true,
          },
        },
      },
    });

    res.json({ ...result, allEvidence });
  } catch (error) {
    console.error('Get compliance detail error:', error);
    res.status(500).json({ error: 'Failed to get detail' });
  }
});

// Get executive summary
router.get('/:bidId/summary', async (req: Request, res: Response) => {
  try {
    const summary = await generateExecutiveSummary(req.params.bidId as string);
    res.json({ summary });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

export default router;
