import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { collectDefaultMetrics, register, Counter, Histogram } from 'prom-client';
import winston from 'winston';

// Create server logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'metrics-server' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Create a stream object for Morgan
const stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

const app = express();
const PORT = 9090;

// Initialize Prometheus metrics
collectDefaultMetrics({ timeout: 5000 });

// Custom metrics
const httpRequestDurationMicroseconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 1.5, 2, 3, 5, 10] // buckets for response time
});

const httpRequestTotal = new Counter({
  name: 'http_request_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

// Setup request logging
app.use(morgan('combined', { stream }));

// Middleware to measure request duration
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestDurationMicroseconds
      .labels(req.method, req.path, res.statusCode.toString())
      .observe(duration / 1000); // Convert to seconds
    httpRequestTotal
      .labels(req.method, req.path, res.statusCode.toString())
      .inc();
    
    // Log request
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  next();
});

// Enable all CORS requests
app.use(cors());
app.use(express.json());

// Initialize metrics storage
let customMetrics = {
  requestDurations: [],
  requestCounts: {},
  lastUpdate: null
};

// Basic home route
app.get('/', (req, res) => {
  logger.info('Home route accessed');
  res.json({ message: 'Metrics server is running' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    metrics: {
      durationsCount: customMetrics.requestDurations.length,
      countsKeys: Object.keys(customMetrics.requestCounts).length
    }
  });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    logger.info('Prometheus metrics requested');
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  } catch (err) {
    logger.error('Error collecting Prometheus metrics', { error: err });
    res.status(500).send(err);
  }
});

// Custom metrics endpoint
app.get('/custom-metrics', (req, res) => {
  logger.info('Custom metrics requested');
  res.json({
    metrics: customMetrics,
    serverTime: new Date().toISOString()
  });
});

// Update metrics endpoint
app.post('/update-metrics', (req, res) => {
  try {
    logger.info('Received metrics update', { body: req.body });
    
    const newMetrics = req.body;
    
    // Validate incoming metrics
    if (!newMetrics || typeof newMetrics !== 'object') {
      logger.error('Invalid metrics format', { metrics: newMetrics });
      return res.status(400).json({ error: 'Invalid metrics format' });
    }

    // Update request durations
    if (Array.isArray(newMetrics.requestDurations)) {
      customMetrics.requestDurations = customMetrics.requestDurations.concat(newMetrics.requestDurations);
      logger.debug('Updated request durations', { 
        count: newMetrics.requestDurations.length 
      });
    }

    // Update request counts
    if (newMetrics.requestCounts && typeof newMetrics.requestCounts === 'object') {
      customMetrics.requestCounts = {
        ...customMetrics.requestCounts,
        ...newMetrics.requestCounts
      };
      logger.debug('Updated request counts', { 
        keys: Object.keys(newMetrics.requestCounts) 
      });
    }

    // Update timestamp
    customMetrics.lastUpdate = new Date().toISOString();

    res.json({
      success: true,
      message: 'Metrics updated successfully',
      timestamp: customMetrics.lastUpdate
    });
  } catch (error) {
    logger.error('Error updating metrics', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { 
    error: err,
    path: req.path,
    method: req.method
  });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server started`, {
    port: PORT,
    endpoints: {
      metrics: `http://localhost:${PORT}/metrics`,
      customMetrics: `http://localhost:${PORT}/custom-metrics`,
      health: `http://localhost:${PORT}/health`
    }
  });
  
  console.log(`
    🚀 Metrics server is running!
    📊 Prometheus metrics: http://localhost:${PORT}/metrics
    📈 Custom metrics: http://localhost:${PORT}/custom-metrics
    ❤️  Health check: http://localhost:${PORT}/health
    🔄 Update metrics: POST http://localhost:${PORT}/update-metrics
  `);
});

server.on('error', (error) => {
  logger.error('Server failed to start', { error });
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
}); 