import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Notification, User } from '../models';
import { NotificationType } from '../config/constants';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { parsePaginationParams, buildPaginationResult } from '../utils/pagination';
import { createInAppNotification, NotificationPayload } from '../services/notificationService';
import { isWithinScope } from '../middleware/rbac';

const listNotifications = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pagination = parsePaginationParams(req, 'created_at', ['created_at', 'is_read', 'notification_type', 'updated_at']);
  const where: any = { user_id: req.user!.user_id };
  if (req.query.is_read !== undefined) where.is_read = req.query.is_read === 'true';
  if (req.query.notification_type) where.notification_type = req.query.notification_type;

  // Support incremental sync updated_after
  if (req.query.updated_after) {
    where.updated_at = { [Op.gt]: new Date(req.query.updated_after as string) };
  }

  const isSync = req.query.sync === 'true';

  const { count, rows } = await Notification.findAndCountAll({
    where,
    order: [[pagination.sortBy, pagination.sortOrder]],
    limit: pagination.limit, offset: pagination.offset,
    paranoid: !isSync, // If syncing, return soft-deleted notifications to sync deletion locally
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

  // 1. Verify that the target recipient user exists
  const targetUser = await User.findByPk(user_id);
  if (!targetUser) {
    apiResponse.notFound(res, 'Target user not found');
    return;
  }

  // 2. Validate regional scope constraints based on the sender's role hierarchy
  if (!isWithinScope(req.user, targetUser)) {
    apiResponse.forbidden(res, 'Cannot send notification to user outside your region or school scope');
    return;
  }

  await createInAppNotification({ user_id, notification_title, notification_message, notification_type });
  apiResponse.created(res, 'Notification sent');
});

export { listNotifications, markAsRead, markAllAsRead, deleteNotification, sendNotification };
