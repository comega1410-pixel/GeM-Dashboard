import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

/**
 * Get audit logs for a bid.
 * GET /api/bids/:bidId/audit
 */
router.get('/:bidId/audit', async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;

    const logs = await prisma.auditLog.findMany({
      where: { bidId },
      orderBy: { timestamp: 'desc' },
    });

    res.json({ logs });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve audit trail' });
  }
});

export default router;
