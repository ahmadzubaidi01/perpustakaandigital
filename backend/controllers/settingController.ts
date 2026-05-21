import { Request, Response } from 'express';
import { BorrowingSetting } from '../models';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { createAuditLog, buildAuditFromRequest } from '../services/auditService';
import { AuditActionType, TABLE_NAMES } from '../config/constants';

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

export { getSettings, updateSettings };
