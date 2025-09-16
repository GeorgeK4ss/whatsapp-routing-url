import express from 'express';
import { config } from './config/settings.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './utils/errors.js';
import { redisManager } from './storage/redis.js';
import { metricsMiddleware, errorMetricsMiddleware, metricsCollector } from './middleware/metrics.js';
import { rateLimitMiddleware, adminRateLimitMiddleware } from './middleware/rateLimit.js';
import adminRouter from './routes/admin.js';
import whatsappRouter from './routes/whatsapp.js';
import telegramRouter from './routes/telegram.js';
import websiteRouter from './routes/website.js';

const app = express();

// Trust proxy for accurate IP detection
app.set('trust proxy', true);

// Request logging middleware
app.use(logger.requestLogger());

// Metrics middleware
app.use(metricsMiddleware);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Powered-By', 'WhatsApp-Geo-Redirect/2.0');
  next();
});

// Rate limiting
app.use(rateLimitMiddleware);

// Routes
app.use('/admin', adminRateLimitMiddleware, adminRouter);
app.use('/', whatsappRouter);
app.use('/', telegramRouter);
app.use('/', websiteRouter);

// Root endpoint - health check and status
app.get('/', async (req, res) => {
  try {
    const [configHealth, storageHealth, metrics] = await Promise.all([
      config.getEnvironmentStatus(),
      redisManager.healthCheck(),
      Promise.resolve(metricsCollector.getMetrics())
    ]);
    
    res.json({
      ok: true,
      service: 'WhatsApp Geo Redirect',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      environment: configHealth,
      storage: storageHealth,
      metrics: {
        uptime: metrics.uptime,
        requests: metrics.requests.total,
        avgResponseTime: metrics.calculated.avgResponseTime,
        errorRate: metrics.calculated.errorRate,
        cacheHitRate: metrics.calculated.cacheHitRate
      },
      endpoints: {
        whatsapp: '/wa',
        telegram: '/tg',
        website: '/website',
        admin: '/admin',
        health: '/health',
        metrics: '/metrics'
      }
    });
  } catch (error) {
    logger.error('Root endpoint error', { error: error.message });
    res.status(500).json({
      ok: false,
      error: 'Service temporarily unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  try {
    const metrics = metricsCollector.getMetrics();
    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Metrics endpoint error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((req, res) => {
  logger.warn('404 Not Found', { url: req.originalUrl, method: req.method, ip: req.ip });
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    timestamp: new Date().toISOString()
  });
});

// Error metrics middleware
app.use(errorMetricsMiddleware);

// Global error handler
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  try {
    // Close Redis connection
    await redisManager.disconnect();
    logger.info('Redis connection closed');
    
    // Close server
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason: reason?.message || reason, promise });
  process.exit(1);
});

// Start server
const PORT = config.get('port');
const server = app.listen(PORT, () => {
  logger.info('WhatsApp Geo Redirect Service started', {
    port: PORT,
    nodeEnv: config.get('nodeEnv'),
    version: '2.0.0'
  });
});

// Server error handling
server.on('error', (error) => {
  logger.error('Server error', { error: error.message });
  process.exit(1);
});

export default app;
