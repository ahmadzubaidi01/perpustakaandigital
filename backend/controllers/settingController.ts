import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { BorrowingSetting, Book, User, BookQr } from '../models';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { createAuditLog, buildAuditFromRequest } from '../services/auditService';
import { AuditActionType, TABLE_NAMES } from '../config/constants';
import env from '../config/environment';

const getSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.params.school_id || req.user!.school_id;
  if (!schoolId) { apiResponse.badRequest(res, 'School ID required'); return; }
  const settings = await BorrowingSetting.findOne({ where: { school_id: schoolId } });
  if (!settings) { apiResponse.notFound(res, 'Borrowing settings not found for this school'); return; }
  apiResponse.success(res, 'Settings retrieved', settings);
});

const updateSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.params.school_id || req.user!.school_id;
  if (!schoolId) { apiResponse.badRequest(res, 'School ID required'); return; }
  const settings = await BorrowingSetting.findOne({ where: { school_id: schoolId } });
  if (!settings) { apiResponse.notFound(res, 'Settings not found'); return; }

  const oldValues = settings.toJSON();
  const { max_borrow_days, max_books_per_student, penalty_rate_per_day, allow_extensions, max_extensions } = req.body;
  const updates: any = {};
  if (max_borrow_days !== undefined) updates.max_borrow_days = max_borrow_days;
  if (max_books_per_student !== undefined) updates.max_books_per_student = max_books_per_student;
  if (penalty_rate_per_day !== undefined) updates.penalty_rate_per_day = penalty_rate_per_day;
  if (allow_extensions !== undefined) updates.allow_extensions = allow_extensions;
  if (max_extensions !== undefined) updates.max_extensions = max_extensions;

  await settings.update(updates);
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.UPDATE, TABLE_NAMES.BORROWING_SETTINGS, settings.setting_id, oldValues, updates));
  apiResponse.success(res, 'Settings updated', settings);
});

const cleanupUnusedFiles = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // 1. Retrieve all active (non-deleted) referenced paths from db
  // Find all books' cover image URLs
  const books = await Book.findAll({
    attributes: ['cover_image_url'],
    paranoid: true, // only active books
  });
  const activeCovers = new Set(
    books
      .map(b => b.cover_image_url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0)
  );

  // Find all users' profile photos and member QR UUIDs
  const users = await User.findAll({
    attributes: ['profile_photo_url', 'member_qr_uuid'],
    paranoid: true, // only active users
  });
  const activeProfiles = new Set(
    users
      .map(u => u.profile_photo_url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0)
  );
  const activeMemberQrUuids = new Set(
    users
      .map(u => u.member_qr_uuid)
      .filter((uuid): uuid is string => typeof uuid === 'string' && uuid.length > 0)
  );

  // Find all active book QRs
  const bookQrs = await BookQr.findAll({
    attributes: ['qr_image_url'],
    paranoid: true, // only active Book QRs
  });
  const activeBookQrs = new Set(
    bookQrs
      .map(q => q.qr_image_url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0)
  );

  // 2. Scan directories on disk
  const uploadDir = path.resolve(__dirname, '..', env.UPLOAD_DIR || 'uploads');
  const qrDir = path.join(uploadDir, 'qr');
  const memberQrDir = path.join(uploadDir, 'member-qr');

  let deletedCount = 0;
  let bytesFreed = 0;

  // Safe helper to delete a file and accumulate statistics
  const safelyDeleteFile = (filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          bytesFreed += stats.size;
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    } catch (err) {
      // silent or log
    }
  };

  // 3. Scan uploads/ (directly - covers and profile photos)
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          // It's a file under uploads/. Check if it is used
          const dbPath = `/uploads/${file}`;
          const isUsed = activeCovers.has(dbPath) || activeProfiles.has(dbPath);
          if (!isUsed) {
            // Unused! Delete it
            safelyDeleteFile(filePath);
          }
        }
      } catch (err) {
        // ignore
      }
    }
  }

  // 4. Scan uploads/qr/ (book QRs)
  if (fs.existsSync(qrDir)) {
    const files = fs.readdirSync(qrDir);
    for (const file of files) {
      const filePath = path.join(qrDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          const dbPath = `/uploads/qr/${file}`;
          const isUsed = activeBookQrs.has(dbPath);
          if (!isUsed) {
            safelyDeleteFile(filePath);
          }
        }
      } catch (err) {
        // ignore
      }
    }
  }

  // 5. Scan uploads/member-qr/ (member QRs)
  if (fs.existsSync(memberQrDir)) {
    const files = fs.readdirSync(memberQrDir);
    for (const file of files) {
      const filePath = path.join(memberQrDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          // Filename format: member-${memberQrUuid}-${timestamp}.png
          // Parse memberQrUuid out of it
          const match = file.match(/^member-([a-f0-9\-]+)-\d+\.png$/i);
          let isUsed = false;
          if (match) {
            const uuid = match[1];
            isUsed = activeMemberQrUuids.has(uuid);
          }
          if (!isUsed) {
            safelyDeleteFile(filePath);
          }
        }
      } catch (err) {
        // ignore
      }
    }
  }

  // Audit log
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.DELETE, TABLE_NAMES.BORROWING_SETTINGS, 0, null, {
    action: 'cleanup_unused_files',
    deleted_files_count: deletedCount,
    bytes_freed: bytesFreed
  }));

  apiResponse.success(res, 'Pembersihan file server selesai', {
    deleted_files_count: deletedCount,
    bytes_freed: bytesFreed,
    formatted_space_saved: (bytesFreed / (1024 * 1024)).toFixed(2) + ' MB',
  });
});

export { getSettings, updateSettings, cleanupUnusedFiles };
