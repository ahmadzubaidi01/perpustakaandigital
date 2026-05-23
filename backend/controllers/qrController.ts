import { Request, Response } from 'express';
import { Op, Transaction } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { sequelize, BookQr, Book, QrScanLog, Borrowing, BorrowingSetting } from '../models';
import { QrStatus, ScanType, AuditActionType, TABLE_NAMES, UserRole, BorrowingStatus, PenaltyStatus } from '../config/constants';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { generateBookQrCodes, validateQrPayload, generateQrDataUrl } from '../services/qrService';
import { createAuditLog, buildAuditFromRequest } from '../services/auditService';
import { parsePaginationParams, buildPaginationResult } from '../utils/pagination';
import { buildRegionalFilter } from '../middleware/rbac';
import { syncBookStock } from '../services/stockSyncService';
import { calculateLatePenalty, isPastDue } from '../utils/helpers';
import env from '../config/environment';

const listBookQrs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pagination = parsePaginationParams(req, 'created_at', ['created_at', 'qr_serial_number', 'qr_status']);
  const where: any = {};
  if (req.query.book_id) where.book_id = req.query.book_id;
  if (req.query.qr_status) where.qr_status = req.query.qr_status;

  // Build scoped book include
  const regionFilter = buildRegionalFilter(req.user);
  const bookWhere: any = {};
  if (regionFilter.school_id) bookWhere.school_id = regionFilter.school_id;
  else if (regionFilter.district_id) bookWhere.district_id = regionFilter.district_id;
  else if (regionFilter.regency_id) bookWhere.regency_id = regionFilter.regency_id;

  const schoolInclude: any = { association: 'school', attributes: ['school_id', 'school_name', 'district_id', 'regency_id'] };
  if (Object.keys(bookWhere).length > 0) {
    schoolInclude.where = bookWhere;
    schoolInclude.required = true;
  }

  const bookInclude: any = {
    association: 'book',
    attributes: ['book_id', 'book_title', 'book_code', 'school_id'],
    include: [schoolInclude]
  };
  if (Object.keys(bookWhere).length > 0) {
    bookInclude.required = true;
  }

  const { count, rows } = await BookQr.findAndCountAll({
    where,
    include: [bookInclude],
    order: [[pagination.sortBy, pagination.sortOrder]],
    limit: pagination.limit, offset: pagination.offset,
  });
  apiResponse.paginated(res, 'Book QR codes retrieved', rows, buildPaginationResult(count, pagination));
});

const getBookQr = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const qr = await BookQr.findByPk(req.params.book_qr_id as string, {
    include: [
      { association: 'book', required: false, attributes: ['book_id', 'book_title', 'book_code', 'school_id'] },
      { association: 'last_scanned_by', required: false, attributes: ['user_id', 'full_name'] },
      { 
        association: 'borrowings', 
        required: false, 
        limit: 5, 
        order: [['created_at', 'DESC']], 
        include: [{ association: 'borrower', required: false, attributes: ['user_id', 'full_name'] }] 
      },
    ],
  });
  if (!qr) { apiResponse.notFound(res, 'Book QR not found'); return; }
  apiResponse.success(res, 'Book QR retrieved', qr);
});

const generateQrCodes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { book_id, quantity, custom_serial } = req.body;
  const book = await Book.findByPk(book_id);
  if (!book) { apiResponse.notFound(res, 'Book not found'); return; }

  const existingQrCount = await BookQr.count({ where: { book_id: book.book_id } });
  if (existingQrCount + quantity > book.total_stock) {
    apiResponse.badRequest(res, `Gagal: Stok buku hanya ${book.total_stock}, sedangkan total QR yang akan ada adalah ${existingQrCount + quantity}.`);
    return;
  }

  try {
    const qrCodes = await generateBookQrCodes(book.book_id, book.school_id, quantity, custom_serial || undefined);
    const createdQrs = [];
    for (const qr of qrCodes) {
      const created = await BookQr.create({ book_id: book.book_id, qr_uuid: qr.qr_uuid, qr_serial_number: qr.qr_serial_number, qr_image_url: qr.qr_image_url });
      createdQrs.push(created);
    }

    await syncBookStock(book.book_id);

    await createAuditLog(buildAuditFromRequest(req, AuditActionType.GENERATE_QR, TABLE_NAMES.BOOK_QR, book.book_id, null, { quantity, serial_numbers: qrCodes.map(q => q.qr_serial_number) }));
    apiResponse.created(res, `${quantity} QR codes generated`, createdQrs);
  } catch (err: any) {
    if (err.statusCode === 400) {
      apiResponse.badRequest(res, err.message);
    } else {
      throw err;
    }
  }
});

const scanQr = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { qr_payload, scan_type, latitude, longitude } = req.body;

  const validation = validateQrPayload(qr_payload);
  if (!validation.valid) { apiResponse.badRequest(res, validation.error || 'Invalid QR'); return; }

  const bookQr = await BookQr.findOne({
    where: { qr_uuid: validation.data!.uuid },
    include: [{ association: 'book', include: [{ association: 'school', attributes: ['school_id', 'school_name'] }] }],
  });
  if (!bookQr) { apiResponse.notFound(res, 'QR code not found in system'); return; }

  // Check if this physical book is currently borrowed by the same user scanning it
  const activeBorrowing = await Borrowing.findOne({
    where: {
      book_qr_id: bookQr.book_qr_id,
      user_id: req.user!.user_id,
      borrowing_status: { [Op.in]: [BorrowingStatus.BORROWED, BorrowingStatus.LATE] }
    }
  });

  if (activeBorrowing) {
    // Automatically process return!
    const result = await sequelize.transaction(async (t: Transaction) => {
      const now = new Date();
      let penaltyAmount = parseFloat(String(activeBorrowing.late_penalty_amount || 0));
      let penaltyStatus = activeBorrowing.penalty_status;

      if (activeBorrowing.due_date && isPastDue(activeBorrowing.due_date)) {
        const settings = await BorrowingSetting.findOne({ where: { school_id: (bookQr as any).book?.school_id }, transaction: t });
        const rate = settings ? parseFloat(String(settings.penalty_rate_per_day)) : env.DEFAULT_PENALTY_RATE_PER_DAY;
        const additionalPenalty = calculateLatePenalty(activeBorrowing.due_date, now, rate);
        penaltyAmount += additionalPenalty;
        if (penaltyAmount > 0 && penaltyStatus !== PenaltyStatus.PAID) {
          penaltyStatus = PenaltyStatus.UNPAID;
        }
      }

      await activeBorrowing.update({
        borrowing_status: BorrowingStatus.RETURNED,
        returned_at: now,
        late_penalty_amount: penaltyAmount,
        penalty_status: penaltyStatus,
      }, { transaction: t });

      await bookQr.update({ qr_status: QrStatus.ACTIVE }, { transaction: t });

      await syncBookStock(bookQr.book_id, t);

      return {
        borrowing: activeBorrowing,
        penalty_amount: penaltyAmount,
      };
    });

    // Create return scan log
    await QrScanLog.create({
      book_qr_id: bookQr.book_qr_id,
      scanned_by_user_id: req.user!.user_id,
      scan_type: ScanType.RETURNING,
      latitude: latitude || null,
      longitude: longitude || null,
      device_name: req.deviceInfo?.device_name || null,
      device_type: req.deviceInfo?.device_type || null,
      device_os: req.deviceInfo?.device_os || null,
      browser_name: req.deviceInfo?.browser_name || null,
      browser_version: req.deviceInfo?.browser_version || null,
      scanned_at: new Date(),
    });

    // Create audit log
    await createAuditLog(buildAuditFromRequest(req, AuditActionType.RETURN, TABLE_NAMES.BORROWINGS, result.borrowing.borrowing_id));

    // Send return event notification
    try {
      const { sendReturnEvent } = require('../services/notificationService');
      await sendReturnEvent(req.user!.user_id, (bookQr as any).book?.book_title || 'Buku', result.penalty_amount);
    } catch { /* ignored */ }

    apiResponse.success(res, 'Buku berhasil dikembalikan secara otomatis', {
      book_qr: bookQr,
      book: (bookQr as any).book,
      scan_type: 'auto_return',
      borrowing: result.borrowing,
      penalty_amount: result.penalty_amount,
    });
    return;
  }

  let wasReactivated = false;
  if (bookQr.qr_status !== QrStatus.ACTIVE) {
    // If it was lost or damaged, and admin scans it, we mark it active again (available)
    await bookQr.update({ qr_status: QrStatus.ACTIVE });
    await createAuditLog(buildAuditFromRequest(req, AuditActionType.STATUS_CHANGE, TABLE_NAMES.BOOK_QR, bookQr.book_qr_id, { qr_status: bookQr.qr_status }, { qr_status: QrStatus.ACTIVE }));
    wasReactivated = true;
    await syncBookStock(bookQr.book_id);
  }

  // Update last scan info
  await bookQr.update({
    last_scanned_at: new Date(),
    last_scanned_latitude: latitude || null,
    last_scanned_longitude: longitude || null,
    last_scanned_by_user_id: req.user!.user_id,
  });

  // Create scan log (immutable)
  await QrScanLog.create({
    book_qr_id: bookQr.book_qr_id,
    scanned_by_user_id: req.user!.user_id,
    scan_type: scan_type || ScanType.VERIFICATION,
    latitude: latitude || null,
    longitude: longitude || null,
    device_name: req.deviceInfo?.device_name || null,
    device_type: req.deviceInfo?.device_type || null,
    device_os: req.deviceInfo?.device_os || null,
    browser_name: req.deviceInfo?.browser_name || null,
    browser_version: req.deviceInfo?.browser_version || null,
    scanned_at: new Date(),
  });

  await createAuditLog(buildAuditFromRequest(req, AuditActionType.SCAN_QR, TABLE_NAMES.BOOK_QR, bookQr.book_qr_id));

  apiResponse.success(res, 'QR scanned successfully', {
    book_qr: bookQr,
    book: (bookQr as any).book,
    scan_type,
    was_reactivated: wasReactivated
  });
});

const updateQrStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const bookQrId = parseInt(req.params.book_qr_id as string, 10);
  const { qr_status, notes } = req.body;

  const validStatuses = Object.values(QrStatus);
  if (!validStatuses.includes(qr_status)) {
    apiResponse.badRequest(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    return;
  }

  const { markBookQrStatus } = require('../services/inventoryService');
  const qr = await markBookQrStatus(bookQrId, qr_status, notes || null, req.user);
  apiResponse.success(res, 'QR status updated', qr);
});

const getQrDownloadData = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const qr = await BookQr.findByPk(req.params.book_qr_id as string, { include: [{ association: 'book', attributes: ['book_title', 'book_code'] }] });
  if (!qr) { apiResponse.notFound(res, 'Book QR not found'); return; }
  const payload = JSON.stringify({ uuid: qr.qr_uuid, serial: qr.qr_serial_number, book_id: qr.book_id, type: 'book_qr', version: 1 });
  const dataUrl = await generateQrDataUrl(payload);
  apiResponse.success(res, 'QR download data', { qr_data_url: dataUrl, qr_serial_number: qr.qr_serial_number, book_title: (qr as any).book?.book_title });
});

const getScanLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pagination = parsePaginationParams(req, 'scanned_at', ['scanned_at', 'scan_type']);
  const where: any = {};
  if (req.query.book_qr_id) where.book_qr_id = req.query.book_qr_id;
  if (req.query.scan_type) where.scan_type = req.query.scan_type;
  if (req.query.scanned_by_user_id) where.scanned_by_user_id = req.query.scanned_by_user_id;

  // Build scoped book include for scan logs
  const regionFilter = buildRegionalFilter(req.user);
  const bookWhere: any = {};
  if (regionFilter.school_id) bookWhere.school_id = regionFilter.school_id;
  else if (regionFilter.district_id) bookWhere.district_id = regionFilter.district_id;
  else if (regionFilter.regency_id) bookWhere.regency_id = regionFilter.regency_id;

  const schoolInclude: any = { association: 'school', attributes: ['school_id', 'school_name', 'district_id', 'regency_id'] };
  if (Object.keys(bookWhere).length > 0) {
    schoolInclude.where = bookWhere;
    schoolInclude.required = true;
  }

  const bookInclude: any = {
    association: 'book',
    attributes: ['book_id', 'book_title'],
    include: [schoolInclude]
  };
  if (Object.keys(bookWhere).length > 0) {
    bookInclude.required = true;
  }

  const { count, rows } = await QrScanLog.findAndCountAll({
    where,
    include: [
      { association: 'book_qr', attributes: ['book_qr_id', 'qr_serial_number'], required: Object.keys(bookWhere).length > 0, include: [bookInclude] },
      { association: 'scanned_by', attributes: ['user_id', 'full_name'] },
    ],
    order: [[pagination.sortBy, pagination.sortOrder]],
    limit: pagination.limit, offset: pagination.offset,
  });
  apiResponse.paginated(res, 'Scan logs retrieved', rows, buildPaginationResult(count, pagination));
});

const deleteQrCode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const qrId = req.params.book_qr_id as string;

  const result = await sequelize.transaction(async (t: Transaction) => {
    // 1. Find the BookQr
    const qr = await BookQr.findByPk(qrId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!qr) {
      throw Object.assign(new Error('Book QR not found'), { statusCode: 404 });
    }

    // 2. Find the associated Book
    const book = await Book.findByPk(qr.book_id, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!book) {
      throw Object.assign(new Error('Associated book not found'), { statusCode: 404 });
    }

    const activeBorrowings = await Borrowing.findAll({
      where: {
        book_qr_id: qr.book_qr_id,
        borrowing_status: {
          [Op.in]: [
            BorrowingStatus.PENDING,
            BorrowingStatus.APPROVED,
            BorrowingStatus.BORROWED,
            BorrowingStatus.LATE,
          ],
        },
      },
      transaction: t,
    });

    // 3. Update all active borrowings associated with this QR to returned status


    const now = new Date();
    for (const borrowing of activeBorrowings) {
      await borrowing.update(
        {
          borrowing_status: BorrowingStatus.RETURNED,
          returned_at: now,
        },
        { transaction: t }
      );
    }

    // 4. Soft delete the QR code
    await qr.destroy({ transaction: t });

    // 5. Recalculate and sync book stock
    await syncBookStock(book.book_id, t);

    return { qr, book };
  });

  // Delete the physical QR image file from disk after successful deletion in db
  if (result.qr && result.qr.qr_image_url) {
    const oldPath = path.resolve(__dirname, '..', result.qr.qr_image_url.replace(/^\//, ''));
    if (fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch (err) {
        // silent
      }
    }
  }

  await createAuditLog(buildAuditFromRequest(req, AuditActionType.DELETE, TABLE_NAMES.BOOK_QR, result.qr.book_qr_id));
  apiResponse.success(res, 'Book QR code deleted successfully and associated borrowings closed');
});

export { listBookQrs, getBookQr, generateQrCodes, scanQr, updateQrStatus, getQrDownloadData, getScanLogs, deleteQrCode };
