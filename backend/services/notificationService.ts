import nodemailer from 'nodemailer';
import { Notification, Borrowing, BookQr, Book, User } from '../models';
import { NotificationType, BorrowingStatus, UserRole } from '../config/constants';
import { Op } from 'sequelize';
import env from '../config/environment';
import logger from '../utils/logger';

/**
 * Email transporter setup.
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });
};

interface NotificationPayload {
  user_id: number;
  notification_title: string;
  notification_message: string;
  notification_type: NotificationType;
}

/**
 * Create an in-app notification.
 */
const createInAppNotification = async (payload: NotificationPayload): Promise<void> => {
  try {
    const notification = await Notification.create({
      user_id: payload.user_id,
      notification_title: payload.notification_title,
      notification_message: payload.notification_message,
      notification_type: payload.notification_type,
      is_read: false,
      sent_at: new Date(),
    });

    logger.info('In-app notification created', {
      user_id: payload.user_id,
      type: payload.notification_type,
    });

    // Automatically emit via socket.io to the recipient in real-time
    try {
      const { emitNotification } = require('./socketService');
      emitNotification(payload.user_id, {
        notification_id: notification.notification_id,
        notification_title: payload.notification_title,
        notification_message: payload.notification_message,
        notification_type: payload.notification_type,
        is_read: false,
        created_at: (notification as any).createdAt || new Date(),
      });
    } catch (socketErr: any) {
      logger.warn('Failed to emit notification via socket', { error: socketErr.message });
    }
  } catch (error: any) {
    logger.error('Failed to create in-app notification', {
      error: error.message,
      user_id: payload.user_id,
    });
  }
};

/**
 * Send email notification.
 * Supports delivery retries.
 */
const sendEmailNotification = async (
  to: string,
  subject: string,
  htmlBody: string,
  retries: number = 3
): Promise<boolean> => {
  const transporter = createTransporter();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await transporter.sendMail({
        from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
        to,
        subject,
        html: htmlBody,
      });

      logger.info('Email sent successfully', { to, subject, attempt });
      return true;
    } catch (error: any) {
      logger.warn(`Email send attempt ${attempt} failed`, {
        to,
        subject,
        error: error.message,
      });

      if (attempt === retries) {
        logger.error('Email send failed after all retries', {
          to,
          subject,
          error: error.message,
        });
        return false;
      }

      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }

  return false;
};

/**
 * Send due date reminder notification.
 */
const sendDueReminder = async (
  userId: number,
  bookTitle: string,
  dueDate: Date,
  email?: string
): Promise<void> => {
  const formattedDate = dueDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  await createInAppNotification({
    user_id: userId,
    notification_title: 'Book Due Date Reminder',
    notification_message: `Your borrowed book "${bookTitle}" is due on ${formattedDate}. Please return it on time to avoid late penalties.`,
    notification_type: NotificationType.DUE_REMINDER,
  });

  if (email) {
    sendEmailNotification(
      email,
      `Book Due Date Reminder - ${bookTitle}`,
      `
        <h2>Due Date Reminder</h2>
        <p>Your borrowed book <strong>"${bookTitle}"</strong> is due on <strong>${formattedDate}</strong>.</p>
        <p>Please return it on time to avoid late penalties.</p>
      `
    ).catch((err: any) => logger.error('Failed to send due reminder email in background', { error: err.message }));
  }
};

/**
 * Send late return warning notification.
 */
const sendLateWarning = async (
  userId: number,
  bookTitle: string,
  daysLate: number,
  penaltyAmount: number,
  email?: string
): Promise<void> => {
  await createInAppNotification({
    user_id: userId,
    notification_title: 'Late Return Warning',
    notification_message: `Your book "${bookTitle}" is ${daysLate} day(s) late. Current penalty: Rp ${penaltyAmount.toLocaleString()}.`,
    notification_type: NotificationType.LATE_WARNING,
  });

  if (email) {
    sendEmailNotification(
      email,
      `Late Return Warning - ${bookTitle}`,
      `
        <h2>Late Return Warning</h2>
        <p>Your book <strong>"${bookTitle}"</strong> is <strong>${daysLate} day(s)</strong> overdue.</p>
        <p>Current late penalty: <strong>Rp ${penaltyAmount.toLocaleString()}</strong></p>
        <p>Please return the book as soon as possible.</p>
      `
    ).catch((err: any) => logger.error('Failed to send late return warning email in background', { error: err.message }));
  }
};

/**
 * Send book availability notification.
 */
const sendAvailabilityNotice = async (
  userId: number,
  bookTitle: string,
  email?: string
): Promise<void> => {
  await createInAppNotification({
    user_id: userId,
    notification_title: 'Book Now Available',
    notification_message: `The book "${bookTitle}" you reserved is now available. Please pick it up within 48 hours.`,
    notification_type: NotificationType.AVAILABILITY_NOTICE,
  });

  if (email) {
    sendEmailNotification(
      email,
      `Book Available - ${bookTitle}`,
      `
        <h2>Book Now Available</h2>
        <p>The book <strong>"${bookTitle}"</strong> you reserved is now available for pickup.</p>
        <p>Please collect it within 48 hours before the reservation expires.</p>
      `
    ).catch((err: any) => logger.error('Failed to send book availability email in background', { error: err.message }));
  }
};

/**
 * Get all admin users who should be notified for a given school's event.
 * Includes School Admins of the school, District Admins of the school's district,
 * Regency Admins of the school's regency, and Super Admins.
 */
const getAdminsForSchool = async (schoolId: number): Promise<User[]> => {
  try {
    const { School } = require('../models');
    const school = await School.findByPk(schoolId);
    if (!school) return [];

    const regencyId = school.regency_id;
    const districtId = school.district_id;

    const admins = await User.findAll({
      where: {
        account_status: 'active',
        [Op.or]: [
          { user_role: UserRole.SUPER_ADMIN },
          { user_role: UserRole.REGENCY_ADMIN, regency_id: regencyId },
          { user_role: UserRole.DISTRICT_ADMIN, district_id: districtId },
          { user_role: UserRole.SCHOOL_ADMIN, school_id: schoolId }
        ]
      }
    });
    return admins;
  } catch (err) {
    logger.error('Failed to get admins for school', err);
    return [];
  }
};

/**
 * Send borrowing event notification (borrow approved, etc.).
 */
const sendBorrowingEvent = async (
  userId: number,
  bookTitle: string,
  eventType: 'approved' | 'created' | 'quick_borrow' | 'extended'
): Promise<void> => {
  const messages: Record<string, string> = {
    approved: `Peminjaman buku "${bookTitle}" telah disetujui.`,
    created: `Permintaan peminjaman buku "${bookTitle}" berhasil dibuat.`,
    quick_borrow: `Buku "${bookTitle}" berhasil dipinjamkan kepada Anda.`,
    extended: `Peminjaman buku "${bookTitle}" telah diperpanjang.`,
  };

  // 1. Notify the student (borrower)
  await createInAppNotification({
    user_id: userId,
    notification_title: 'Peminjaman Buku',
    notification_message: messages[eventType] || `Update peminjaman: ${bookTitle}`,
    notification_type: NotificationType.BORROWING_EVENT,
  });

  // 2. Notify all administrative accounts in scope
  try {
    const student = await User.findByPk(userId);
    if (student && student.school_id) {
      const admins = await getAdminsForSchool(student.school_id);
      
      const adminMessages: Record<string, string> = {
        approved: `Peminjaman buku "${bookTitle}" oleh ${student.full_name} telah disetujui.`,
        created: `Permintaan peminjaman baru untuk buku "${bookTitle}" oleh ${student.full_name} perlu disetujui.`,
        quick_borrow: `Peminjaman langsung buku "${bookTitle}" oleh ${student.full_name} berhasil dicatat.`,
        extended: `Perpanjangan peminjaman buku "${bookTitle}" oleh ${student.full_name} berhasil dicatat.`,
      };

      for (const admin of admins) {
        if (admin.user_id !== userId) {
          await createInAppNotification({
            user_id: admin.user_id,
            notification_title: 'Pemberitahuan Peminjaman (Admin)',
            notification_message: adminMessages[eventType] || `Peminjaman oleh ${student.full_name}: ${bookTitle}`,
            notification_type: NotificationType.BORROWING_EVENT,
          });
        }
      }
    }
  } catch (err: any) {
    logger.error('Failed to notify admins of borrowing event:', err.message);
  }
};

/**
 * Send return event notification.
 */
const sendReturnEvent = async (
  userId: number,
  bookTitle: string,
  penaltyAmount: number = 0
): Promise<void> => {
  const penaltyInfo = penaltyAmount > 0
    ? ` Denda keterlambatan: Rp ${penaltyAmount.toLocaleString()}.`
    : '';

  // 1. Notify student
  await createInAppNotification({
    user_id: userId,
    notification_title: 'Pengembalian Buku',
    notification_message: `Buku "${bookTitle}" berhasil dikembalikan.${penaltyInfo}`,
    notification_type: NotificationType.RETURN_EVENT,
  });

  // 2. Notify all administrative accounts in scope
  try {
    const student = await User.findByPk(userId);
    if (student && student.school_id) {
      const admins = await getAdminsForSchool(student.school_id);
      for (const admin of admins) {
        if (admin.user_id !== userId) {
          await createInAppNotification({
            user_id: admin.user_id,
            notification_title: 'Pemberitahuan Pengembalian (Admin)',
            notification_message: `Buku "${bookTitle}" oleh ${student.full_name} berhasil dikembalikan.${penaltyInfo}`,
            notification_type: NotificationType.RETURN_EVENT,
          });
        }
      }
    }
  } catch (err: any) {
    logger.error('Failed to notify admins of return event:', err.message);
  }
};

/**
 * Send stock anomaly alert to admin users.
 */
const sendStockAnomalyAlert = async (
  adminUserIds: number[],
  bookTitle: string,
  anomalyType: string
): Promise<void> => {
  const typeLabels: Record<string, string> = {
    qr_count_mismatch: 'Jumlah QR tidak sesuai dengan stok buku',
    stock_inconsistency: 'Stok tersedia + stok dipinjam melebihi stok total',
  };

  for (const userId of adminUserIds) {
    await createInAppNotification({
      user_id: userId,
      notification_title: 'Peringatan Anomali Stok',
      notification_message: `Buku "${bookTitle}": ${typeLabels[anomalyType] || anomalyType}`,
      notification_type: NotificationType.STOCK_ANOMALY,
    });
  }
};

/**
 * Send inventory audit alert.
 */
const sendInventoryAlert = async (
  adminUserIds: number[],
  schoolName: string,
  details: string
): Promise<void> => {
  for (const userId of adminUserIds) {
    await createInAppNotification({
      user_id: userId,
      notification_title: 'Audit Inventaris',
      notification_message: `Audit inventaris di ${schoolName}: ${details}`,
      notification_type: NotificationType.INVENTORY_MISMATCH,
    });
  }
};

/**
 * Processes daily due reminders and late warnings for all active student borrowings.
 */
const runDailyBorrowingReminders = async (): Promise<void> => {
  logger.info('Starting daily borrowing reminders processing...');
  try {
    const today = new Date();

    // Find all active borrowings (borrowed or late)
    const activeBorrowings = await Borrowing.findAll({
      where: {
        borrowing_status: {
          [Op.in]: [BorrowingStatus.BORROWED, BorrowingStatus.LATE]
        }
      },
      include: [
        {
          model: BookQr,
          as: 'book_qr',
          include: [
            {
              model: Book,
              as: 'book'
            }
          ]
        },
        {
          model: User,
          as: 'borrower'
        }
      ]
    });

    logger.info(`Found ${activeBorrowings.length} active borrowings to check for reminders.`);

    let notificationsCount = 0;

    for (const borrowing of activeBorrowings) {
      if (!borrowing.due_date) continue;

      const bookTitle = borrowing.book_qr?.book?.book_title || 'Buku';
      const borrowerId = borrowing.user_id;
      const dueDateObj = new Date(borrowing.due_date);

      const getStartOfDay = (date: Date): Date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      const d1 = getStartOfDay(today);
      const d2 = getStartOfDay(dueDateObj);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      const formattedDate = dueDateObj.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (diffDays === 2) {
        // 2 days before
        await createInAppNotification({
          user_id: borrowerId,
          notification_title: 'Pengingat Pengembalian Buku',
          notification_message: `Buku "${bookTitle}" harus dikembalikan dalam 2 hari (pada ${formattedDate}).`,
          notification_type: NotificationType.DUE_REMINDER,
        });
        notificationsCount++;
      } else if (diffDays === 1) {
        // 1 day before
        await createInAppNotification({
          user_id: borrowerId,
          notification_title: 'Pengingat Pengembalian Buku',
          notification_message: `Buku "${bookTitle}" harus dikembalikan besok (pada ${formattedDate}).`,
          notification_type: NotificationType.DUE_REMINDER,
        });
        notificationsCount++;
      } else if (diffDays === 0) {
        // Today
        await createInAppNotification({
          user_id: borrowerId,
          notification_title: 'Batas Waktu Pengembalian',
          notification_message: `Hari ini adalah batas waktu pengembalian buku "${bookTitle}".`,
          notification_type: NotificationType.DUE_REMINDER,
        });
        notificationsCount++;
      } else if (diffDays < 0) {
        // Overdue! Compute positive days late
        const daysLate = Math.abs(diffDays);
        await createInAppNotification({
          user_id: borrowerId,
          notification_title: 'Buku Terlambat Dikembalikan',
          notification_message: `Buku "${bookTitle}" terlambat dikembalikan. Terlambat ${daysLate} hari.`,
          notification_type: NotificationType.LATE_WARNING,
        });
        notificationsCount++;
      }
    }

    logger.info(`Daily borrowing reminders processing completed. Created ${notificationsCount} notifications.`);
  } catch (error: any) {
    logger.error('Failed to process daily borrowing reminders:', { error: error.message });
  }
};

/**
 * Send chat message notification.
 */
const sendChatMessageNotification = async (
  recipientId: number,
  senderName: string,
  messageText: string
): Promise<void> => {
  try {
    // Find existing unread message notification from this sender
    const existing = await Notification.findOne({
      where: {
        user_id: recipientId,
        notification_type: NotificationType.ADMIN_MESSAGE,
        is_read: false,
        notification_title: { [Op.like]: `%Pesan Baru dari ${senderName}%` }
      }
    });

    if (existing) {
      // Group them up
      const match = existing.notification_title.match(/^(\d+)\s+Pesan Baru/);
      const count = match ? parseInt(match[1], 10) + 1 : 2;
      
      await existing.update({
        notification_title: `${count} Pesan Baru dari ${senderName}`,
        notification_message: messageText,
        sent_at: new Date()
      });

      // Emit socket event for the updated notification
      const { emitNotification } = require('./socketService');
      emitNotification(recipientId, {
        notification_id: existing.notification_id,
        notification_title: `${count} Pesan Baru dari ${senderName}`,
        notification_message: messageText,
        notification_type: NotificationType.ADMIN_MESSAGE,
        is_read: false,
        created_at: new Date(),
      });
      return;
    }
  } catch (err: any) {
    logger.warn('Failed to group chat notifications', { error: err.message });
  }

  await createInAppNotification({
    user_id: recipientId,
    notification_title: `Pesan Baru dari ${senderName}`,
    notification_message: messageText,
    notification_type: NotificationType.ADMIN_MESSAGE,
  });
};

export {
  createInAppNotification,
  sendEmailNotification,
  sendDueReminder,
  sendLateWarning,
  sendAvailabilityNotice,
  sendBorrowingEvent,
  sendReturnEvent,
  sendStockAnomalyAlert,
  sendInventoryAlert,
  runDailyBorrowingReminders,
  sendChatMessageNotification,
  NotificationPayload,
};
