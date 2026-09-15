import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { upload } from '../middleware/upload';
import { logAuditEvent } from '../services/auditLogger';

const router = Router();

// Upload documents to a bid
router.post('/:bidId/documents', upload.array('files', 20), async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const bid = await prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

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

    const actor = (req.headers['x-user-email'] as string) || 'officer@gem.gov.in';
    await logAuditEvent({
      bidId,
      action: 'DOCUMENT_UPLOADED',
      actor,
      notes: `Uploaded ${savedDocs.length} document(s): ${files.map((f) => f.originalname).join(', ')}`,
    });

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
        extractionConfidence: true,
        userCorrected: true,
        correctedDocType: true,
        createdAt: true,
      },
    });
    res.json(docs);
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// Correct document type by officer
router.patch('/:bidId/documents/:docId/type', async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;
    const docId = req.params.docId as string;
    const { docType } = req.body;

    if (!docType) {
      return res.status(400).json({ error: 'docType is required' });
    }

    const existing = await prisma.document.findUnique({
      where: { id: docId },
    });

    if (!existing || existing.bidId !== bidId) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const previousType = existing.docType;

    const updated = await prisma.document.update({
      where: { id: docId },
      data: {
        docType,
        userCorrected: true,
        correctedDocType: docType,
      },
    });

    const actor = (req.headers['x-user-email'] as string) || 'officer@gem.gov.in';
    await logAuditEvent({
      bidId,
      action: 'DOCUMENT_TYPE_CORRECTED',
      actor,
      entityType: 'DOCUMENT',
      entityId: docId,
      previousState: previousType,
      newState: docType,
      notes: `Officer updated document type from ${previousType} to ${docType} for ${existing.originalName}`,
    });

    res.json({ message: 'Document classification updated successfully', document: updated });
  } catch (error) {
    console.error('Update doc type error:', error);
    res.status(500).json({ error: 'Failed to update document classification' });
  }
});

export default router;
