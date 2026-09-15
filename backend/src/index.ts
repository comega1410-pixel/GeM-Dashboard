import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authMiddleware } from './middleware/rbac';
import bidsRouter from './routes/bids';
import documentsRouter from './routes/documents';
import complianceRouter from './routes/compliance';
import reportRouter from './routes/report';
import reviewRouter from './routes/review';
import auditRouter from './routes/audit';
import benchmarkRouter from './routes/benchmark';

const app = express();

// Middleware
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware as any);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    system: 'GeM Compliance Copilot v2.0 (SIH Edition)',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/bids', bidsRouter);
app.use('/api/bids', documentsRouter);     // /api/bids/:bidId/documents, PATCH type
app.use('/api/bids', complianceRouter);    // /api/bids/:bidId/analyze, /compliance, /summary
app.use('/api/bids', reviewRouter);        // /api/bids/:bidId/review/:resultId, /contradictions/:id/resolve
app.use('/api/bids', auditRouter);         // /api/bids/:bidId/audit
app.use('/api/bids', reportRouter);        // /api/bids/:bidId/report
app.use('/api/benchmark', benchmarkRouter); // /api/benchmark/run, /seed-demo

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(config.port, () => {
  console.log(`🚀 GeM Compliance Copilot API running on http://localhost:${config.port}`);
  console.log(`   CORS origin: ${config.corsOrigin}`);
});

export default app;
