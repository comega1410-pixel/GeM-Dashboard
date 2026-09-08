import express from 'express';
import cors from 'cors';
import { config } from './config';
import bidsRouter from './routes/bids';
import documentsRouter from './routes/documents';
import complianceRouter from './routes/compliance';
import reportRouter from './routes/report';

const app = express();

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/bids', bidsRouter);
app.use('/api/bids', documentsRouter);     // /api/bids/:bidId/documents
app.use('/api/bids', complianceRouter);     // /api/bids/:bidId/analyze, /compliance, /summary
app.use('/api/bids', reportRouter);         // /api/bids/:bidId/report

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(config.port, () => {
  console.log(`🚀 GeM Compliance API running on http://localhost:${config.port}`);
  console.log(`   CORS origin: ${config.corsOrigin}`);
});

export default app;
