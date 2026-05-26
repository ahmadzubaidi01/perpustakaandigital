import { Router, Request, Response } from 'express';
import authRoutes from './v1/auth';
import bookRoutes from './v1/books';
import borrowingRoutes from './v1/borrowings';
import userRoutes from './v1/users';
import regionRoutes from './v1/regions';
import categoryRoutes from './v1/categories';
import qrRoutes from './v1/qr';
import notificationRoutes from './v1/notifications';
import dashboardRoutes from './v1/dashboard';
import auditRoutes from './v1/audit';
import reviewRoutes from './v1/reviews';
import settingRoutes from './v1/settings';
import chatRoutes from './v1/chat';
import inventoryRoutes from './v1/inventory';
import { isRedisHealthy } from '../config/redis';
import sequelize from '../config/database';
import env from '../config/environment';
import apiResponse from '../utils/apiResponse';
import { generalLimiter } from '../middleware/rateLimiter';
import { deviceTracker } from '../middleware/deviceTracker';

const router = Router();

// Apply global middleware
router.use(deviceTracker);
// router.use(generalLimiter); // Commented out to prevent HTTP 429 lockouts during mobile background sync

// Health check endpoints
router.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = { api: 'healthy' };

  // Database health check
  try {
    await sequelize.authenticate();
    checks.database = 'healthy';
  } catch {
    checks.database = 'unhealthy';
  }

  // Redis health check
  try {
    if (!env.REDIS_ENABLED) {
      checks.redis = 'disabled';
    } else {
      const redisHealthy = await isRedisHealthy();
      checks.redis = redisHealthy ? 'healthy' : 'unhealthy';
    }
  } catch {
    checks.redis = 'unavailable';
  }

  const allHealthy = Object.values(checks).every((v) => v === 'healthy' || v === 'unavailable' || v === 'disabled');
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    success: allHealthy,
    message: allHealthy ? 'All systems operational' : 'Some systems are unhealthy',
    data: checks,
    error: null,
    metadata: { timestamp: new Date().toISOString() },
  });
});

// API v1 routes
router.use('/v1/auth', authRoutes);
router.use('/v1/books', bookRoutes);
router.use('/v1/borrowings', borrowingRoutes);

router.use('/v1/users', userRoutes);
router.use('/v1/regions', regionRoutes);
router.use('/v1/categories', categoryRoutes);
router.use('/v1/qr', qrRoutes);
router.use('/v1/notifications', notificationRoutes);
router.use('/v1/dashboard', dashboardRoutes);
router.use('/v1/audit', auditRoutes);
router.use('/v1/reviews', reviewRoutes);
router.use('/v1/settings', settingRoutes);
router.use('/v1/chat', chatRoutes);
router.use('/v1/inventory', inventoryRoutes);

export default router;
