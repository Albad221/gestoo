import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { createApiRouter } from './api';
import { JobScheduler } from './jobs';
import { loadConfig, isJobSchedulingEnabled } from './config';

// Load configuration
const config = loadConfig();

// Initialize Supabase client
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });

  next();
});

// CORS middleware for development
if (config.environment === 'development') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });
}

// Mount API router
app.use('/api', createApiRouter(supabase));

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Intelligence Service',
    version: '1.0.0',
    status: 'running',
    environment: config.environment,
    endpoints: {
      api: '/api',
      health: '/api/health',
      info: '/api/info',
    },
  });
});

// Job management endpoints
let jobScheduler: JobScheduler | null = null;

app.get('/jobs', (req: Request, res: Response) => {
  if (!jobScheduler) {
    return res.json({ message: 'Job scheduler not initialized', jobs: [] });
  }

  res.json({
    jobs: jobScheduler.getAllJobStatuses(),
  });
});

app.post('/jobs/:name/trigger', async (req: Request, res: Response) => {
  if (!jobScheduler) {
    return res.status(503).json({ error: 'Job scheduler not initialized' });
  }

  const { name } = req.params;
  const success = await jobScheduler.triggerJob(name);

  if (success) {
    res.json({ message: `Job ${name} triggered successfully` });
  } else {
    res.status(400).json({ error: `Failed to trigger job ${name}` });
  }
});

app.post('/jobs/:name/start', (req: Request, res: Response) => {
  if (!jobScheduler) {
    return res.status(503).json({ error: 'Job scheduler not initialized' });
  }

  const { name } = req.params;
  const success = jobScheduler.startJob(name);

  if (success) {
    res.json({ message: `Job ${name} started` });
  } else {
    res.status(400).json({ error: `Failed to start job ${name}` });
  }
});

app.post('/jobs/:name/stop', (req: Request, res: Response) => {
  if (!jobScheduler) {
    return res.status(503).json({ error: 'Job scheduler not initialized' });
  }

  const { name } = req.params;
  const success = jobScheduler.stopJob(name);

  if (success) {
    res.json({ message: `Job ${name} stopped` });
  } else {
    res.status(400).json({ error: `Failed to stop job ${name}` });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error]', err);

  res.status(500).json({
    success: false,
    error: config.environment === 'development' ? err.message : 'Internal server error',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// Start server
const server = app.listen(config.port, () => {
  console.log('='.repeat(60));
  console.log('Intelligence Service');
  console.log('='.repeat(60));
  console.log(`Environment: ${config.environment}`);
  console.log(`Port: ${config.port}`);
  console.log(`API Base: http://localhost:${config.port}/api`);
  console.log('='.repeat(60));

  // Initialize job scheduler if enabled
  if (isJobSchedulingEnabled()) {
    jobScheduler = new JobScheduler(supabase);
    jobScheduler.initialize({
      dailyRiskUpdate: config.jobSchedules.dailyRiskUpdate,
      weeklyReport: config.jobSchedules.weeklyReport,
      monthlyTrendAnalysis: config.jobSchedules.monthlyTrendAnalysis,
    });
    jobScheduler.startAll();
    console.log('Job scheduler initialized and started');
  } else {
    console.log('Job scheduler disabled');
  }

  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');

  if (jobScheduler) {
    jobScheduler.stopAll();
  }

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');

  if (jobScheduler) {
    jobScheduler.stopAll();
  }

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
