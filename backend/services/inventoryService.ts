import { Op, Transaction } from 'sequelize';
import { sequelize, Book, BookQr, Borrowing, User, School, District } from '../models';
import { QrStatus, BorrowingStatus, AuditActionType, TABLE_NAMES, UserRole } from '../config/constants';
import { createAuditLog } from './auditService';
import { createInAppNotification } from './notificationService';
import { syncBookStock } from './stockSyncService';
import { NotificationType } from '../config/constants';
import logger from '../utils/logger';

/**
 * Inventory service — centralized QR stock management and traceability.
 */

/**
 * Mark a book QR with a specific status (lost, damaged, inactive, active).
 * Generates audit log and triggers stock sync + notification propagation.
 */
const markBookQrStatus = async (
  bookQrId: number,
  newStatus: QrStatus,
  notes: string | null,
  adminUser: Express.Request['user']
): Promise<BookQr> => {
  const result = await sequelize.transaction(async (t: Transaction) => {
    const qr = await BookQr.findByPk(bookQrId, {
      lock: Transaction.LOCK.UPDATE,
      transaction: t,
      include: [{ association: 'book', attributes: ['book_id', 'book_title', 'school_id'] }],
    });

    if (!qr) throw Object.assign(new Error('Book QR not found'), { statusCode: 404 });

    const oldStatus = qr.qr_status;
    await qr.update({ qr_status: newStatus, notes: notes || qr.notes }, { transaction: t });

    // If status is updated to something other than ACTIVE or BORROWED (inactive, damaged, lost, maintenance),
    // automatically close any active borrowings for this copy
    if (newStatus !== QrStatus.ACTIVE && newStatus !== QrStatus.BORROWED) {
      const activeBorrowings = await Borrowing.findAll({
        where: {
          book_qr_id: bookQrId,
          borrowing_status: {
            [Op.in]: [
              BorrowingStatus.BORROWED,
              BorrowingStatus.APPROVED,
              BorrowingStatus.LATE,
              BorrowingStatus.PENDING,
              BorrowingStatus.RESERVED,
            ],
          },
        },
        transaction: t,
      });

      for (const borrowing of activeBorrowings) {
        await borrowing.update(
          {
            borrowing_status: BorrowingStatus.RETURNED,
            returned_at: new Date(),
          },
          { transaction: t }
        );
      }
    }

    // Sync book stock after status change
    const book = (qr as any).book;
    if (book) {
      await syncBookStock(book.book_id, t);
    }

    return { qr, oldStatus, book };
  });

  // Audit log
  const actionMap: Record<string, AuditActionType> = {
    [QrStatus.LOST]: AuditActionType.MARK_LOST,
    [QrStatus.DAMAGED]: AuditActionType.MARK_DAMAGED,
    [QrStatus.INACTIVE]: AuditActionType.MARK_INACTIVE,
    [QrStatus.ACTIVE]: AuditActionType.RESTORE_BOOK,
  };

  await createAuditLog({
    action_type: actionMap[newStatus] || AuditActionType.STATUS_CHANGE,
    table_name: TABLE_NAMES.BOOK_QR,
    affected_record_id: bookQrId,
    old_value: { qr_status: result.oldStatus },
    new_value: { qr_status: newStatus, notes },
    performed_by_user_id: adminUser?.user_id || null,
  });

  // Propagate alerts for lost/damaged books up the hierarchy
  if (newStatus === QrStatus.LOST || newStatus === QrStatus.DAMAGED) {
    await propagateStockAlert(
      result.book?.school_id,
      result.book?.book_title || 'Unknown',
      newStatus,
      adminUser
    );
  }

  return result.qr;
};

/**
 * Propagate stock alert notifications up the admin hierarchy.
 * School → District → Regency → Super Admin
 */
const propagateStockAlert = async (
  schoolId: number | undefined,
  bookTitle: string,
  alertType: string,
  triggeringAdmin: Express.Request['user']
): Promise<void> => {
  if (!schoolId) return;

  try {
    const school = await School.findByPk(schoolId, {
      include: [{ association: 'district', include: [{ association: 'regency' }] }],
    });
    if (!school) return;

    const notifType = alertType === QrStatus.LOST
      ? NotificationType.BOOK_LOST
      : NotificationType.BOOK_DAMAGED;

    const schoolName = school.school_name;
    const message = `Buku "${bookTitle}" ditandai sebagai ${alertType} di ${schoolName}`;

    // Find admins up the chain
    const adminWhere: any[] = [
      { user_role: UserRole.SUPER_ADMIN, account_status: 'active' },
    ];

    if (school.regency_id) {
      adminWhere.push({
        user_role: UserRole.REGENCY_ADMIN,
        regency_id: school.regency_id,
        account_status: 'active',
      });
    }

    if (school.district_id) {
      adminWhere.push({
        user_role: UserRole.DISTRICT_ADMIN,
        district_id: school.district_id,
        account_status: 'active',
      });
    }

    const admins = await User.findAll({
      where: {
        [Op.or]: adminWhere,
        user_id: { [Op.ne]: triggeringAdmin?.user_id || 0 },
      },
      attributes: ['user_id'],
    });

    // Send notification to each admin
    for (const admin of admins) {
      await createInAppNotification({
        user_id: admin.user_id,
        notification_title: `Peringatan Stok: Buku ${alertType === QrStatus.LOST ? 'Hilang' : 'Rusak'}`,
        notification_message: message,
        notification_type: notifType,
      });
    }
  } catch (error: any) {
    logger.error('Failed to propagate stock alert', { error: error.message, schoolId, alertType });
  }
};

/**
 * Detect stock anomalies — mismatches between QR count and book stock.
 */
const getStockAnomalies = async (schoolId?: number): Promise<any[]> => {
  const bookWhere: any = {};
  if (schoolId) bookWhere.school_id = schoolId;

  const books = await Book.findAll({
    where: bookWhere,
    attributes: ['book_id', 'book_title', 'book_code', 'total_stock', 'available_stock', 'borrowed_stock', 'school_id'],
    include: [
      {
        association: 'qr_codes',
        attributes: ['book_qr_id', 'qr_status'],
      },
    ],
  });

  const anomalies: any[] = [];

  for (const book of books) {
    const qrCodes = (book as any).qr_codes || [];
    const activeQrCount = qrCodes.filter((qr: any) => qr.qr_status === QrStatus.ACTIVE).length;
    const totalQrCount = qrCodes.length;
    const lostCount = qrCodes.filter((qr: any) => qr.qr_status === QrStatus.LOST).length;
    const damagedCount = qrCodes.filter((qr: any) => qr.qr_status === QrStatus.DAMAGED).length;

    // Check for mismatches
    if (totalQrCount !== book.total_stock || book.available_stock + book.borrowed_stock > book.total_stock) {
      anomalies.push({
        book_id: book.book_id,
        book_title: book.book_title,
        book_code: book.book_code,
        school_id: book.school_id,
        total_stock: book.total_stock,
        available_stock: book.available_stock,
        borrowed_stock: book.borrowed_stock,
        total_qr_count: totalQrCount,
        active_qr_count: activeQrCount,
        lost_count: lostCount,
        damaged_count: damagedCount,
        anomaly_type: totalQrCount !== book.total_stock ? 'qr_count_mismatch' : 'stock_inconsistency',
      });
    }
  }

  return anomalies;
};

/**
 * Get full traceability for a specific QR code.
 */
const getQrTraceability = async (bookQrId: number): Promise<any> => {
  const qr = await BookQr.findByPk(bookQrId, {
    include: [
      {
        association: 'book',
        attributes: ['book_id', 'book_title', 'book_code', 'school_id'],
        include: [
          { association: 'school', attributes: ['school_id', 'school_name', 'district_id', 'regency_id'] },
        ],
      },
      {
        association: 'borrowings',
        include: [
          { association: 'borrower', attributes: ['user_id', 'full_name', 'class_name'] },
          { association: 'approved_by', attributes: ['user_id', 'full_name'] },
        ],
        order: [['created_at', 'DESC']],
        limit: 20,
      },
      {
        association: 'scan_logs',
        include: [
          { association: 'scanned_by', attributes: ['user_id', 'full_name'] },
        ],
        order: [['scanned_at', 'DESC']],
        limit: 20,
      },
      {
        association: 'last_scanned_by',
        attributes: ['user_id', 'full_name'],
      },
    ],
  });

  return qr;
};

/**
 * Run full inventory audit for a school — reconcile all QR vs stock.
 */
const runInventoryAudit = async (
  schoolId: number,
  adminUser: Express.Request['user']
): Promise<{ synced_books: number; anomalies: any[] }> => {
  const books = await Book.findAll({
    where: { school_id: schoolId },
    attributes: ['book_id'],
  });

  let syncedCount = 0;
  for (const book of books) {
    await syncBookStock(book.book_id);
    syncedCount++;
  }

  const anomalies = await getStockAnomalies(schoolId);

  await createAuditLog({
    action_type: AuditActionType.INVENTORY_AUDIT,
    table_name: TABLE_NAMES.BOOKS,
    affected_record_id: schoolId,
    new_value: { synced_books: syncedCount, anomalies_found: anomalies.length },
    performed_by_user_id: adminUser?.user_id || null,
  });

  return { synced_books: syncedCount, anomalies };
};

/**
 * Initialize stock from zero — for schools starting inventory from scratch.
 */
const initializeStockFromZero = async (
  schoolId: number,
  adminUser: Express.Request['user']
): Promise<{ initialized_books: number }> => {
  const books = await Book.findAll({
    where: { school_id: schoolId },
    attributes: ['book_id'],
  });

  let count = 0;
  for (const book of books) {
    await syncBookStock(book.book_id);
    count++;
  }

  await createAuditLog({
    action_type: AuditActionType.STOCK_INITIAL,
    table_name: TABLE_NAMES.BOOKS,
    affected_record_id: schoolId,
    new_value: { initialized_books: count },
    performed_by_user_id: adminUser?.user_id || null,
  });

  return { initialized_books: count };
};

export {
  markBookQrStatus,
  propagateStockAlert,
  getStockAnomalies,
  getQrTraceability,
  runInventoryAudit,
  initializeStockFromZero,
};
