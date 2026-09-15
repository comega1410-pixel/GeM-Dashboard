import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logAuditEvent } from '../services/auditLogger';
import { ComplianceStatus } from '../types';

const router = Router();

/**
 * Override or update reviewer decision on a compliance result.
 * POST /api/bids/:bidId/review/:resultId
 */
router.post('/:bidId/review/:resultId', async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;
    const resultId = req.params.resultId as string;
    const { decision, reason, reviewerName } = req.body;

    const validStatuses: ComplianceStatus[] = ['COMPLIANT', 'NON_COMPLIANT', 'NEEDS_REVIEW'];
    if (!validStatuses.includes(decision)) {
      return res.status(400).json({ error: `Invalid decision. Allowed: ${validStatuses.join(', ')}` });
    }

    const existingResult = await prisma.complianceResult.findUnique({
      where: { id: resultId },
      include: { requirement: true },
    });

    if (!existingResult || existingResult.bidId !== bidId) {
      return res.status(404).json({ error: 'Compliance result not found' });
    }

    const previousStatus = existingResult.finalStatus || existingResult.status;
    const reviewer = reviewerName || (req.headers['x-user-email'] as string) || 'Procurement Officer';

    // Update result with human override while preserving AI / Rule recommendation
    const updated = await prisma.complianceResult.update({
      where: { id: resultId },
      data: {
        finalStatus: decision,
        reviewedBy: reviewer,
        reviewerDecision: decision,
        reviewerReason: reason || null,
        reviewedAt: new Date(),
        isMandatoryIssue: decision === 'NON_COMPLIANT' && existingResult.requirement.mandatory,
      },
      include: { requirement: true, evidence: true },
    });

    // Record in Audit Trail
    await logAuditEvent({
      bidId,
      action: 'DECISION_OVERRIDDEN',
      actor: reviewer,
      entityType: 'COMPLIANCE_RESULT',
      entityId: resultId,
      previousState: previousStatus,
      newState: decision,
      notes: `Requirement ${existingResult.requirement.code} decision updated to ${decision}. Reason: ${reason || 'N/A'}`,
    });

    res.json({
      message: 'Review decision recorded successfully',
      result: updated,
    });
  } catch (error) {
    console.error('Record review decision error:', error);
    res.status(500).json({ error: 'Failed to record review decision' });
  }
});

/**
 * Resolve a detected contradiction.
 * POST /api/bids/:bidId/contradictions/:contradictionId/resolve
 */
router.post('/:bidId/contradictions/:contradictionId/resolve', async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;
    const contradictionId = req.params.contradictionId as string;
    const { resolutionNotes, resolvedBy } = req.body;

    const contradiction = await prisma.contradiction.findUnique({
      where: { id: contradictionId },
    });

    if (!contradiction || contradiction.bidId !== bidId) {
      return res.status(404).json({ error: 'Contradiction record not found' });
    }

    const actor = resolvedBy || (req.headers['x-user-email'] as string) || 'Procurement Officer';

    const updated = await prisma.contradiction.update({
      where: { id: contradictionId },
      data: {
        resolved: true,
        resolutionNotes: resolutionNotes || 'Resolved during officer review.',
        resolvedBy: actor,
      },
    });

    await logAuditEvent({
      bidId,
      action: 'CONTRADICTION_RESOLVED',
      actor,
      entityType: 'CONTRADICTION',
      entityId: contradictionId,
      notes: `Contradiction on ${contradiction.fieldName} resolved. Notes: ${resolutionNotes || 'N/A'}`,
    });

    res.json({
      message: 'Contradiction resolved successfully',
      contradiction: updated,
    });
  } catch (error) {
    console.error('Resolve contradiction error:', error);
    res.status(500).json({ error: 'Failed to resolve contradiction' });
  }
});

export default router;
