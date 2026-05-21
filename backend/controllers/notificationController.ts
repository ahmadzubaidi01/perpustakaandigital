import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Notification } from '../models';
import { NotificationType } from '../config/constants';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { parsePaginationParams, buildPaginationResult } from '../utils/pagination';
import { createInAppNotification, NotificationPayload } from '../services/notificationService';

const listNotifications = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pagination = parsePaginationParams(req, 'created_at', ['created_at', 'is_read', 'notification_type']);
  const where: any = { user_id: req.user!.user_id };
  if (req.query.is_read !== undefined) where.is_read = req.query.is_read === 'true';
  if (req.query.notification_type) where.notification_type = req.query.notification_type;

  const { count, rows } = await Notification.findAndCountAll({
    where,
    order: [[pagination.sortBy, pagination.sortOrder]],
    limit: pagination.limit, offset: pagination.offset,
  });
  const unreadCount = await Notification.count({ where: { user_id: req.user!.user_id, is_read: false } });
  apiResponse.paginated(res, 'Notifications retrieved', rows, buildPaginationResult(count, pagination), { unread_count: unreadCount });
});

const markAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const notification = await Notification.findOne({ where: { notification_id: req.params.notification_id, user_id: req.user!.user_id } });
  if (!notification) { apiResponse.notFound(res, 'Notification not found'); return; }
  await notification.update({ is_read: true });
  apiResponse.success(res, 'Notification marked as read', notification);
});

const markAllAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await Notification.update({ is_read: true }, { where: { user_id: req.user!.user_id, is_read: false } });
  apiResponse.success(res, 'All notifications marked as read');
});

const deleteNotification = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const notification = await Notification.findOne({ where: { notification_id: req.params.notification_id, user_id: req.user!.user_id } });
  if (!notification) { apiResponse.notFound(res, 'Notification not found'); return; }
  await notification.destroy();
  apiResponse.success(res, 'Notification deleted');
});

const sendNotification = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { user_id, notification_title, notification_message, notification_type } = req.body;
  await createInAppNotification({ user_id, notification_title, notification_message, notification_type });
  apiResponse.created(res, 'Notification sent');
});

export { listNotifications, markAsRead, markAllAsRead, deleteNotification, sendNotification };
