import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { runComplianceAnalysis, generateExecutiveSummary } from '../services/complianceEngine';
import { computeRiskScore } from '../services/riskScorer';

const router = Router();

// Trigger compliance analysis for a bid
router.post('/:bidId/analyze', async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;

    const bid = await prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    if (bid.status === 'PROCESSING') {
      return res.status(409).json({ error: 'Analysis already in progress' });
    }

    // Run analysis in background (don't await for response)
    // But for prototype simplicity, we'll await it
    res.json({ message: 'Analysis started', bidId, status: 'PROCESSING' });

    // Run asynchronously after sending response
    runComplianceAnalysis(bidId).catch((error) => {
      console.error(`Analysis failed for bid ${bidId}:`, error);
    });
  } catch (error) {
    console.error('Start analysis error:', error);
    res.status(500).json({ error: 'Failed to start analysis' });
  }
});

// Get compliance matrix for a bid
router.get('/:bidId/compliance', async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;

    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      select: { id: true, title: true, status: true, gemBidNumber: true },
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

    // Compute risk score
    const riskItems = results.map((r: any) => ({
      status: r.status,
      category: r.requirement.category,
      mandatory: r.requirement.mandatory,
    }));

    const riskScore = computeRiskScore(riskItems);

    res.json({
      bid,
      results,
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

    // Get all evidence for this bid to show context
    const allEvidence = await prisma.evidence.findMany({
      where: {
        document: { bidId },
      },
      include: {
        document: {
          select: {
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
