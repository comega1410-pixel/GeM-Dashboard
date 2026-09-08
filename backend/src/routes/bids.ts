import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

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
            createdAt: true,
          },
        },
        requirements: {
          orderBy: { code: 'asc' },
        },
        results: {
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
        },
        _count: {
          select: {
            documents: true,
            requirements: true,
            results: true,
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
    await prisma.bid.delete({
      where: { id: req.params.id as string },
    });
    res.json({ message: 'Bid deleted' });
  } catch (error) {
    console.error('Delete bid error:', error);
    res.status(500).json({ error: 'Failed to delete bid' });
  }
});

export default router;
