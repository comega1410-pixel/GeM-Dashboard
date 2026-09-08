import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { upload } from '../middleware/upload';

const router = Router();

// Upload documents to a bid
router.post('/:bidId/documents', upload.array('files', 20), async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Check bid exists
    const bid = await prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    // Get docTypes from body (comma-separated or JSON array matching file order)
    let docTypes: string[] = [];
    if (req.body.docTypes) {
      try {
        docTypes = JSON.parse(req.body.docTypes);
      } catch {
        docTypes = req.body.docTypes.split(',').map((t: string) => t.trim());
      }
    }

    const savedDocs = await Promise.all(
      files.map((file, index) => {
        const docType = docTypes[index] || 'OTHER';
        return prisma.document.create({
          data: {
            bidId,
            filename: file.filename,
            originalName: file.originalname,
            docType: docType as any,
            filePath: file.path,
          },
        });
      })
    );

    res.status(201).json(savedDocs);
  } catch (error) {
    console.error('Upload documents error:', error);
    res.status(500).json({ error: 'Failed to upload documents' });
  }
});

// List documents for a bid
router.get('/:bidId/documents', async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;
    const docs = await prisma.document.findMany({
      where: { bidId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        originalName: true,
        docType: true,
        totalPages: true,
        processed: true,
        ocrRequired: true,
        createdAt: true,
      },
    });
    res.json(docs);
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

export default router;
