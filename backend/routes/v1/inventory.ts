import { Router } from 'express';
import {
  updateBookQrStatus,
  bulkUpdateQrStatus,
  listStockAnomalies,
  getQrTrace,
  runAudit,
  initializeStock,
} from '../../controllers/inventoryController';
import { authenticate } from '../../middleware/auth';
import { requireMinRole } from '../../middleware/rbac';
import { UserRole } from '../../config/constants';
import { validate } from '../../middleware/validator';
import Joi from 'joi';

const router = Router();

const statusSchema = {
  body: Joi.object({
    qr_status: Joi.string().valid('active', 'inactive', 'damaged', 'lost').required(),
    notes: Joi.string().max(2000).allow(null, '').optional(),
  }),
};

const bulkStatusSchema = {
  body: Joi.object({
    qr_ids: Joi.array().items(Joi.number().integer().positive()).min(1).max(100).required(),
    qr_status: Joi.string().valid('active', 'inactive', 'damaged', 'lost').required(),
    notes: Joi.string().max(2000).allow(null, '').optional(),
  }),
};

const auditSchema = {
  body: Joi.object({
    school_id: Joi.number().integer().positive().optional(),
  }),
};

// All inventory routes require at least school_admin role
router.get('/anomalies', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), listStockAnomalies);
router.get('/qr/:book_qr_id/trace', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), getQrTrace);
router.patch('/qr/:book_qr_id/status', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), validate(statusSchema), updateBookQrStatus);
router.patch('/qr/bulk-status', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), validate(bulkStatusSchema), bulkUpdateQrStatus);
router.post('/audit', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), validate(auditSchema), runAudit);
router.post('/initialize', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), validate(auditSchema), initializeStock);

export default router;
