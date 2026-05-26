import dotenv from 'dotenv';
dotenv.config({ override: true });

import env from './config/environment';
import logger from './utils/logger';

// Global error handlers to prevent abrupt process termination
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception captured globally', { error: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason: any) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  logger.error('Unhandled Rejection captured globally', { reason: msg, stack });
});

import express, { Application } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { initCronJobs } from './jobs/cron';

import sequelize from './config/database';
import { initRedis } from './config/redis';
import apiRoutes from './routes/index';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { initSocketService } from './services/socketService';

// Import models to initialize associations
import './models/index';

const app: Application = express();
const httpServer = http.createServer(app);
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration
app.use(cors({
  origin: env.CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Name'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

// Serve uploaded files (prevent direct executable access)
const upload_path = path.resolve(__dirname, env.UPLOAD_DIR);

if (!fs.existsSync(upload_path)) {
  fs.mkdirSync(upload_path, { recursive: true });
}

app.use('/uploads', express.static(upload_path, {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
  },
}));

// API routes
app.use('/api', apiRoutes);

// Root health check
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: `${env.APP_NAME} API is running`,
    data: { environment: env.NODE_ENV, timestamp: new Date().toISOString() },
    error: null,
    metadata: null,
  });
});

// 404 handler
app.use(notFoundHandler);

// Centralized error handler (MUST be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Startup check: Uploads folder permissions and directory existence validation
    const uploadDir = path.resolve(__dirname, env.UPLOAD_DIR);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      logger.info('Created uploads storage directory');
    }

    // Database connection with defensive auto-retry logic (5 times, 2s intervals)
    let dbRetries = 5;
    while (dbRetries > 0) {
      try {
        await sequelize.authenticate();
        logger.info('Database connection established successfully');
        break;
      } catch (err: any) {
        dbRetries -= 1;
        logger.warn(`Database connection failed. Retries remaining: ${dbRetries}. Error: ${err.message}`);
        if (dbRetries === 0) {
          throw new Error(`Critical: Database connection failed after multiple retries. ${err.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Redis connection (completely non-blocking background initial boot)
    if (env.REDIS_ENABLED) {
      try {
        await initRedis();
        logger.info('Redis interface initialized in non-blocking background mode');
      } catch (redisError: any) {
        logger.warn('Redis non-blocking initialization skipped or failed', { error: redisError.message });
      }
    } else {
      logger.info('Redis caching is disabled by configuration');
    }

    // Start listening HTTP Server
    httpServer.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`${env.APP_NAME} server running on port ${env.PORT} [${env.NODE_ENV}]`);
});

    // Initialize Socket.IO real-time service
    try {
      initSocketService(httpServer);
      logger.info('Socket.IO real-time service initialized successfully');
    } catch (socketError: any) {
      logger.error('Socket.IO server initialization failed', { error: socketError.message });
    }

    // Initialize background jobs
    try {
      initCronJobs();
      logger.info('Background cron jobs successfully registered');
    } catch (cronError: any) {
      logger.error('Background cron registration failed', { error: cronError.message });
    }
  } catch (error: any) {
    logger.error('Failed to start server cleanly', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Initiating graceful shutdown sequence...`);

  // Force shutdown backup timer (10s)
  const shutdownTimer = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded, forcing process exit');
    process.exit(1);
  }, 10000);

  // Close HTTP and Socket.IO server
  httpServer.close(async () => {
    logger.info('HTTP and WebSocket servers shut down cleanly');

    // Close Database pool connections
    try {
      await sequelize.close();
      logger.info('Sequelize database connection pool successfully closed');
    } catch (err: any) {
      logger.error('Error closing database connections during shutdown', { error: err.message });
    }

    clearTimeout(shutdownTimer);
    logger.info('Graceful shutdown completed successfully. Good bye!');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();

export default app; // Trigger nodemon restart after starting MySQL database server
