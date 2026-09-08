import { Router, Request, Response } from 'express';
import { generateReport } from '../services/reportGenerator';

const router = Router();

/**
 * Download a PDF compliance report for a completed analysis.
 * GET /api/bids/:bidId/report
 */
router.get('/:bidId/report', async (req: Request, res: Response) => {
  try {
    const { bidId } = req.params;

    const pdfDoc = await generateReport(bidId as string);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="compliance-report-${bidId.slice(0, 8)}.pdf"`
    );

    // Pipe the PDF stream to the response
    pdfDoc.pipe(res);
  } catch (error) {
    console.error('Report generation error:', error);
    const message = (error as Error).message || 'Failed to generate report';
    res.status(
      message.includes('not found') ? 404 : message.includes('not yet complete') ? 400 : 500
    ).json({ error: message });
  }
});

export default router;
