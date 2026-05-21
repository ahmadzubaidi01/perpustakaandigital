import express, { Application } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { initCronJobs } from './jobs/cron';

dotenv.config();

import env from './config/environment';
import sequelize from './config/database';
import { initRedis } from './config/redis';
import logger from './utils/logger';
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
    // Database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Redis connection (non-blocking — app works without Redis)
    if (env.REDIS_ENABLED) {
      try {
        await initRedis();
        logger.info('Redis connection established successfully');
      } catch (redisError: any) {
        logger.warn('Redis connection failed — running without cache', { error: redisError.message });
      }
    } else {
      logger.info('Redis caching is disabled by configuration');
    }

    // Start listening
    httpServer.listen(env.PORT, () => {
      logger.info(`${env.APP_NAME} server running on port ${env.PORT} [${env.NODE_ENV}]`);
    });

    // Initialize Socket.IO real-time service
    initSocketService(httpServer);
    logger.info('Socket.IO real-time service initialized');

    // Initialize background jobs
    initCronJobs();
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();

export default app;
