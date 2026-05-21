import { Router } from 'express';
import { listNotifications, markAsRead, markAllAsRead, deleteNotification, sendNotification } from '../../controllers/notificationController';
import { authenticate } from '../../middleware/auth';
import { requireMinRole } from '../../middleware/rbac';
import { UserRole } from '../../config/constants';
import { notificationLimiter } from '../../middleware/rateLimiter';

const router = Router();

router.get('/', authenticate, listNotifications);
router.patch('/read-all', authenticate, markAllAsRead);
router.patch('/:notification_id/read', authenticate, markAsRead);
router.delete('/:notification_id', authenticate, deleteNotification);
router.post('/send', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), notificationLimiter, sendNotification);

export default router;
