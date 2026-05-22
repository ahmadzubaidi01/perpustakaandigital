import nodemailer from 'nodemailer';
import { Notification, Borrowing, BookQr, Book, User } from '../models';
import { NotificationType, BorrowingStatus } from '../config/constants';
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
    await Notification.create({
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
 * Send borrowing event notification (borrow approved, etc.).
 */
const sendBorrowingEvent = async (
  userId: number,
  bookTitle: string,
  eventType: 'approved' | 'created' | 'quick_borrow'
): Promise<void> => {
  const messages: Record<string, string> = {
    approved: `Peminjaman buku "${bookTitle}" telah disetujui. Silakan ambil buku di perpustakaan.`,
    created: `Permintaan peminjaman buku "${bookTitle}" berhasil dibuat. Menunggu persetujuan admin.`,
    quick_borrow: `Buku "${bookTitle}" berhasil dipinjamkan kepada Anda oleh admin.`,
  };

  await createInAppNotification({
    user_id: userId,
    notification_title: 'Peminjaman Buku',
    notification_message: messages[eventType] || `Update peminjaman: ${bookTitle}`,
    notification_type: NotificationType.BORROWING_EVENT,
  });

  // Emit via socket if available
  try {
    const { emitNotification } = require('./socketService');
    emitNotification(userId, {
      type: 'borrowing_event',
      title: 'Peminjaman Buku',
      message: messages[eventType],
      book_title: bookTitle,
    });
  } catch { /* Socket not initialized yet */ }
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

  await createInAppNotification({
    user_id: userId,
    notification_title: 'Pengembalian Buku',
    notification_message: `Buku "${bookTitle}" berhasil dikembalikan.${penaltyInfo}`,
    notification_type: NotificationType.RETURN_EVENT,
  });

  try {
    const { emitNotification } = require('./socketService');
    emitNotification(userId, {
      type: 'return_event',
      title: 'Pengembalian Buku',
      message: `Buku "${bookTitle}" dikembalikan.${penaltyInfo}`,
      penalty_amount: penaltyAmount,
    });
  } catch { /* Socket not initialized */ }
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
        
        // Emit via socket
        try {
          const { emitNotification } = require('./socketService');
          emitNotification(borrowerId, {
            type: 'due_reminder',
            title: 'Pengingat Pengembalian Buku',
            message: `Buku "${bookTitle}" harus dikembalikan dalam 2 hari (pada ${formattedDate}).`,
            book_title: bookTitle,
          });
        } catch {}

        notificationsCount++;
      } else if (diffDays === 1) {
        // 1 day before
        await createInAppNotification({
          user_id: borrowerId,
          notification_title: 'Pengingat Pengembalian Buku',
          notification_message: `Buku "${bookTitle}" harus dikembalikan besok (pada ${formattedDate}).`,
          notification_type: NotificationType.DUE_REMINDER,
        });

        // Emit via socket
        try {
          const { emitNotification } = require('./socketService');
          emitNotification(borrowerId, {
            type: 'due_reminder',
            title: 'Pengingat Pengembalian Buku',
            message: `Buku "${bookTitle}" harus dikembalikan besok (pada ${formattedDate}).`,
            book_title: bookTitle,
          });
        } catch {}

        notificationsCount++;
      } else if (diffDays === 0) {
        // Today
        await createInAppNotification({
          user_id: borrowerId,
          notification_title: 'Batas Waktu Pengembalian',
          notification_message: `Hari ini adalah batas waktu pengembalian buku "${bookTitle}".`,
          notification_type: NotificationType.DUE_REMINDER,
        });

        // Emit via socket
        try {
          const { emitNotification } = require('./socketService');
          emitNotification(borrowerId, {
            type: 'due_reminder',
            title: 'Batas Waktu Pengembalian',
            message: `Hari ini adalah batas waktu pengembalian buku "${bookTitle}".`,
            book_title: bookTitle,
          });
        } catch {}

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

        // Emit via socket
        try {
          const { emitNotification } = require('./socketService');
          emitNotification(borrowerId, {
            type: 'late_warning',
            title: 'Buku Terlambat Dikembalikan',
            message: `Buku "${bookTitle}" terlambat dikembalikan. Terlambat ${daysLate} hari.`,
            book_title: bookTitle,
          });
        } catch {}

        notificationsCount++;
      }
    }

    logger.info(`Daily borrowing reminders processing completed. Created ${notificationsCount} notifications.`);
  } catch (error: any) {
    logger.error('Failed to process daily borrowing reminders:', { error: error.message });
  }
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
  NotificationPayload,
};
