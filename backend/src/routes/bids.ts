import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logAuditEvent } from '../services/auditLogger';

const router = Router();

// Create a new bid
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, gemBidNumber, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const bid = await prisma.bid.create({
      data: {
        title,
        gemBidNumber: gemBidNumber || null,
        description: description || null,
      },
    });

    const actor = (req.headers['x-user-email'] as string) || 'officer@gem.gov.in';
    await logAuditEvent({
      bidId: bid.id,
      action: 'BID_CREATED',
      actor,
      notes: `Created bid: "${bid.title}" (${bid.gemBidNumber || 'No GeM Bid Number'})`,
    });

    res.status(201).json(bid);
  } catch (error) {
    console.error('Create bid error:', error);
    res.status(500).json({ error: 'Failed to create bid' });
  }
});

// List all bids
router.get('/', async (_req: Request, res: Response) => {
  try {
    const bids = await prisma.bid.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            documents: true,
            requirements: true,
            results: true,
            contradictions: true,
          },
        },
      },
    });
    res.json(bids);
  } catch (error) {
    console.error('List bids error:', error);
    res.status(500).json({ error: 'Failed to list bids' });
  }
});

// Get a single bid with full details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const bid = await prisma.bid.findUnique({
      where: { id: req.params.id as string },
      include: {
        documents: {
          select: {
            id: true,
            originalName: true,
            docType: true,
            totalPages: true,
            processed: true,
            extractionConfidence: true,
            userCorrected: true,
            createdAt: true,
          },
        },
        requirements: {
          orderBy: { code: 'asc' },
        },
        contradictions: {
          orderBy: { createdAt: 'desc' },
        },
        results: {
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
        },
        _count: {
          select: {
            documents: true,
            requirements: true,
            results: true,
            contradictions: true,
          },
        },
      },
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    res.json(bid);
  } catch (error) {
    console.error('Get bid error:', error);
    res.status(500).json({ error: 'Failed to get bid' });
  }
});

// Delete a bid
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const actor = (req.headers['x-user-email'] as string) || 'officer@gem.gov.in';

    await logAuditEvent({
      bidId: id,
      action: 'BID_DELETED',
      actor,
      notes: `Deleted bid ${id}`,
    });

    await prisma.bid.delete({
      where: { id },
    });

    res.json({ message: 'Bid deleted successfully' });
  } catch (error) {
    console.error('Delete bid error:', error);
    res.status(500).json({ error: 'Failed to delete bid' });
  }
});

export default router;
