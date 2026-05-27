import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { BookQr, Book } from '../models';
import { QrStatus, AuditActionType, TABLE_NAMES } from '../config/constants';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { buildRegionalFilter } from '../middleware/rbac';
import {
  markBookQrStatus,
  getStockAnomalies,
  getQrTraceability,
  runInventoryAudit,
  initializeStockFromZero,
} from '../services/inventoryService';
import { syncBookStock } from '../services/stockSyncService';
import { deleteCachePattern } from '../config/redis';
import { createAuditLog, buildAuditFromRequest } from '../services/auditService';

/**
 * PATCH /api/v1/inventory/qr/:book_qr_id/status
 * Mark a specific book QR with a new status (lost, damaged, inactive, active).
 */
const updateBookQrStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const bookQrId = parseInt(req.params.book_qr_id as string, 10);
  const { qr_status, notes } = req.body;

  const validStatuses = Object.values(QrStatus);
  if (!validStatuses.includes(qr_status)) {
    apiResponse.badRequest(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    return;
  }

  const qr = await markBookQrStatus(bookQrId, qr_status, notes || null, req.user);
  apiResponse.success(res, 'QR status updated', qr);
});

/**
 * PATCH /api/v1/inventory/qr/bulk-status
 * Bulk update QR statuses.
 */
const bulkUpdateQrStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { qr_ids, qr_status, notes } = req.body;

  if (!Array.isArray(qr_ids) || qr_ids.length === 0) {
    apiResponse.badRequest(res, 'qr_ids must be a non-empty array');
    return;
  }

  const validStatuses = Object.values(QrStatus);
  if (!validStatuses.includes(qr_status)) {
    apiResponse.badRequest(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    return;
  }

  const results = [];
  for (const qrId of qr_ids) {
    try {
      const qr = await markBookQrStatus(qrId, qr_status, notes || null, req.user);
      results.push({ book_qr_id: qrId, success: true, qr_status: qr.qr_status });
    } catch (error: any) {
      results.push({ book_qr_id: qrId, success: false, error: error.message });
    }
  }

  apiResponse.success(res, 'Bulk status update completed', results);
});

/**
 * GET /api/v1/inventory/anomalies
 * Get stock anomalies for the user's scope.
 */
const listStockAnomalies = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const regionFilter = buildRegionalFilter(req.user);
  const schoolId = regionFilter.school_id || (req.query.school_id ? parseInt(req.query.school_id as string, 10) : undefined);

  const anomalies = await getStockAnomalies(schoolId);
  apiResponse.success(res, 'Stock anomalies retrieved', anomalies);
});

/**
 * GET /api/v1/inventory/qr/:book_qr_id/trace
 * Get full traceability for a QR code.
 */
const getQrTrace = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const bookQrId = parseInt(req.params.book_qr_id as string, 10);
  const trace = await getQrTraceability(bookQrId);

  if (!trace) {
    apiResponse.notFound(res, 'Book QR not found');
    return;
  }

  apiResponse.success(res, 'QR traceability retrieved', trace);
});

/**
 * POST /api/v1/inventory/audit
 * Run a full inventory audit for a school.
 */
const runAudit = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const regionFilter = buildRegionalFilter(req.user);
  const schoolId = regionFilter.school_id || req.body.school_id;

  if (!schoolId) {
    apiResponse.badRequest(res, 'school_id is required');
    return;
  }

  const result = await runInventoryAudit(schoolId, req.user);
  apiResponse.success(res, 'Inventory audit completed', result);
});

/**
 * POST /api/v1/inventory/initialize
 * Initialize stock from zero for a school.
 */
const initializeStock = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const regionFilter = buildRegionalFilter(req.user);
  const schoolId = regionFilter.school_id || req.body.school_id;

  if (!schoolId) {
    apiResponse.badRequest(res, 'school_id is required');
    return;
  }

  const result = await initializeStockFromZero(schoolId, req.user);
  apiResponse.success(res, 'Stock initialization completed', result);
});

/**
 * DELETE /api/v1/inventory/anomalies/:book_id
 * Resolve/delete stock anomaly by reconciling total_stock with actual QR codes count.
 */
const deleteStockAnomaly = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const bookId = parseInt(req.params.book_id as string, 10);
  const book = await Book.findByPk(bookId);
  if (!book) {
    apiResponse.notFound(res, 'Book not found');
    return;
  }

  // Enforce regional scope filter
  const { isWithinScope } = require('../middleware/rbac');
  if (!isWithinScope(req.user, book.school_id)) {
    apiResponse.forbidden(res, 'Anda tidak memiliki akses ke data sekolah ini');
    return;
  }

  // Count total physical QR records for this book in MySQL
  const totalQrCount = await BookQr.count({ where: { book_id: bookId } });

  // Update total stock
  const previousTotalStock = book.total_stock;
  await book.update({ total_stock: totalQrCount });

  // Recalculate and sync available/borrowed/total stocks
  await syncBookStock(bookId);

  // Clear Redis caches
  await deleteCachePattern('books:*');

  // Audit log
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.UPDATE, TABLE_NAMES.BOOKS, bookId, null, {
    action: 'reconcile_stock_anomaly',
    previous_total_stock: previousTotalStock,
    new_total_stock: totalQrCount
  }));

  apiResponse.success(res, 'Stock anomaly resolved successfully');
});

export {
  updateBookQrStatus,
  bulkUpdateQrStatus,
  listStockAnomalies,
  deleteStockAnomaly,
  getQrTrace,
  runAudit,
  initializeStock,
};
